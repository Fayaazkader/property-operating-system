BEGIN;

-- Do not discard or overwrite incompatible WIP attempts during migration.
DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM public.execution_final_artifacts GROUP BY execution_id,document_version_id,artifact_type HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate final artifact attempts require explicit reconciliation before migration';
  END IF;
END;
$block$;
CREATE UNIQUE INDEX execution_final_artifacts_identity_uidx ON public.execution_final_artifacts(execution_id,document_version_id,artifact_type);
ALTER TABLE public.execution_final_artifacts ADD COLUMN manifest_sha256 text CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$');

CREATE OR REPLACE FUNCTION public.protect_execution_final_artifacts()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Execution final artifacts cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF current_setting('assetflow.execution_final_artifact_write',true) IS DISTINCT FROM 'stage' OR
       NEW.status IS DISTINCT FROM 'staged' OR NEW.committed_at IS NOT NULL OR NEW.manifest_sha256 IS NULL THEN
      RAISE EXCEPTION 'Governed final artifact registration required';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'committed' THEN RAISE EXCEPTION 'Committed final artifacts are immutable'; END IF;
  IF current_setting('assetflow.execution_final_artifact_write',true) IS DISTINCT FROM 'commit' OR
     (to_jsonb(NEW)-'status'-'committed_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'committed_at') OR
     NEW.status IS DISTINCT FROM 'committed' OR NEW.committed_at IS NULL THEN
    RAISE EXCEPTION 'Invalid governed final artifact transition';
  END IF;
  RETURN NEW;
END;
$function$;

-- Internal common integrity gate. Not callable by application roles.
CREATE FUNCTION public.assert_execution_finalisation_context(p_execution_id uuid,p_document_version_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_manifest public.execution_field_manifests%ROWTYPE;
BEGIN
  SELECT * INTO v_execution FROM public.executions WHERE id=p_execution_id FOR UPDATE;
  IF NOT FOUND OR v_execution.deleted_at IS NOT NULL OR v_execution.is_locked IS DISTINCT FROM true OR
     v_execution.source_type IS DISTINCT FROM 'leasing_opportunity' OR v_execution.status NOT IN ('partially_signed','executed') THEN
    RAISE EXCEPTION 'Execution is not eligible for finalisation';
  END IF;
  SELECT m.* INTO v_manifest FROM public.execution_field_manifests m
    JOIN public.execution_document_versions dv ON dv.id=m.document_version_id
    JOIN public.execution_signing_documents sd ON sd.id=m.signing_document_id
    JOIN public.leasing_opportunities o ON o.id=v_execution.source_id
    WHERE m.execution_id=p_execution_id AND m.document_version_id=p_document_version_id AND m.status='frozen'
      AND m.entity_id=o.entity_id AND dv.entity_id=m.entity_id AND dv.execution_id=p_execution_id
      AND dv.status='active' AND dv.version=v_execution.version
      AND sd.execution_id=p_execution_id AND sd.entity_id=m.entity_id AND sd.document_version_id=dv.id
      AND sd.source_checksum=dv.document_checksum AND sd.source_document_id=dv.document_id
      AND sd.status='committed' AND sd.pdf_checksum=m.pdf_sha256
      AND (v_execution.status='executed' OR dv.document_checksum=v_execution.sha_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'Frozen finalisation source mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.execution_participants WHERE execution_id=p_execution_id) OR
    EXISTS (SELECT 1 FROM public.execution_participants p WHERE p.execution_id=p_execution_id AND (
      p.status IS DISTINCT FROM 'signed' OR p.signed_at IS NULL OR
      p.signature_data->>'manifest_sha256' IS DISTINCT FROM v_manifest.manifest_sha256 OR
      NOT COALESCE((p.signature_data->'completed_field_ids') @> (
        SELECT jsonb_agg(f->'id') FROM jsonb_array_elements(v_manifest.fields) f WHERE (f->>'participantId')::uuid=p.id
      ),false) OR NOT EXISTS (
        SELECT 1 FROM public.execution_signature_evidence se
        WHERE se.execution_id=p_execution_id AND se.participant_id=p.id AND se.document_version_id=p_document_version_id
          AND se.status='committed' AND se.committed_at IS NOT NULL
          AND se.id::text=p.signature_data->>'evidence_id'
          AND se.content_sha256=p.signature_data->>'signature_sha256'
          AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_manifest.fields) f WHERE (f->>'participantId')::uuid=p.id AND f->>'type'='initial')
            OR (se.initials_storage_path IS NOT NULL AND se.initials_sha256=p.signature_data->>'initials_sha256'))
      )
    )) THEN RAISE EXCEPTION 'Execution signatures or mandatory fields are incomplete'; END IF;
  RETURN v_manifest.manifest_sha256;
END;
$function$;
REVOKE ALL ON FUNCTION public.assert_execution_finalisation_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.stage_execution_final_artifact(
  p_execution_id uuid,p_document_version_id uuid,p_artifact_type text,p_storage_path text,p_content_sha256 text,p_content_length bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_hash text; v_old public.execution_final_artifacts%ROWTYPE; v_id uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service authority required'; END IF;
  IF p_artifact_type IS NULL OR p_artifact_type NOT IN ('signed_pdf','execution_certificate') OR
     p_content_sha256 IS NULL OR p_content_sha256 !~ '^[a-f0-9]{64}$' OR
     p_content_length IS NULL OR p_content_length NOT BETWEEN 1 AND 31457280 OR
     p_storage_path IS NULL OR p_storage_path !~ ('^'||p_execution_id::text||'/'||p_document_version_id::text||'/'||p_artifact_type||'/[a-f0-9]{64}[.]pdf$') THEN
    RAISE EXCEPTION 'Invalid final artifact metadata';
  END IF;
  IF p_storage_path IS DISTINCT FROM p_execution_id::text||'/'||p_document_version_id::text||'/'||p_artifact_type||'/'||p_content_sha256||'.pdf' THEN
    RAISE EXCEPTION 'Final artifact path must bind its content hash';
  END IF;
  v_hash := public.assert_execution_finalisation_context(p_execution_id,p_document_version_id);
  SELECT * INTO v_old FROM public.execution_final_artifacts WHERE execution_id=p_execution_id AND document_version_id=p_document_version_id AND artifact_type=p_artifact_type;
  IF FOUND THEN
    IF v_old.content_sha256 IS DISTINCT FROM p_content_sha256 OR v_old.storage_path IS DISTINCT FROM p_storage_path OR
       v_old.content_length IS DISTINCT FROM p_content_length OR v_old.manifest_sha256 IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'Final artifact identity conflict requires reconciliation';
    END IF;
    RETURN v_old.id;
  END IF;
  IF (SELECT status FROM public.executions WHERE id=p_execution_id)='executed' THEN RAISE EXCEPTION 'Executed artifact missing'; END IF;
  PERFORM set_config('assetflow.execution_final_artifact_write','stage',true);
  INSERT INTO public.execution_final_artifacts(execution_id,document_version_id,artifact_type,storage_path,content_sha256,content_length,manifest_sha256)
    VALUES(p_execution_id,p_document_version_id,p_artifact_type,p_storage_path,p_content_sha256,p_content_length,v_hash) RETURNING id INTO v_id;
  PERFORM set_config('assetflow.execution_final_artifact_write','',true);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.commit_execution_final_artifact(p_artifact_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_identity public.execution_final_artifacts%ROWTYPE; v_hash text;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service authority required'; END IF;
  SELECT * INTO v_identity FROM public.execution_final_artifacts WHERE id=p_artifact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Final artifact not found'; END IF;
  -- Parent execution lock precedes all dependent locks on every path.
  v_hash := public.assert_execution_finalisation_context(v_identity.execution_id,v_identity.document_version_id);
  SELECT * INTO v_identity FROM public.execution_final_artifacts WHERE id=p_artifact_id FOR UPDATE;
  IF v_identity.manifest_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Final artifact manifest mismatch'; END IF;
  IF v_identity.status='committed' THEN RETURN p_artifact_id; END IF;
  PERFORM set_config('assetflow.execution_final_artifact_write','commit',true);
  UPDATE public.execution_final_artifacts SET status='committed',committed_at=now() WHERE id=p_artifact_id;
  PERFORM set_config('assetflow.execution_final_artifact_write','',true);
  RETURN p_artifact_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_execution_finalisation(p_execution_id uuid,p_document_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_hash text; v_signed public.execution_final_artifacts%ROWTYPE; v_certificate public.execution_final_artifacts%ROWTYPE;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service authority required'; END IF;
  v_hash := public.assert_execution_finalisation_context(p_execution_id,p_document_version_id);
  SELECT * INTO v_signed FROM public.execution_final_artifacts WHERE execution_id=p_execution_id AND document_version_id=p_document_version_id
    AND artifact_type='signed_pdf' AND status='committed' AND manifest_sha256=v_hash;
  SELECT * INTO v_certificate FROM public.execution_final_artifacts WHERE execution_id=p_execution_id AND document_version_id=p_document_version_id
    AND artifact_type='execution_certificate' AND status='committed' AND manifest_sha256=v_hash;
  IF v_signed.id IS NULL OR v_certificate.id IS NULL THEN RAISE EXCEPTION 'Both final artifacts must be committed'; END IF;
  IF (SELECT status FROM public.executions WHERE id=p_execution_id)='executed' THEN
    IF NOT EXISTS(SELECT 1 FROM public.executions WHERE id=p_execution_id AND sha_hash=v_signed.content_sha256
      AND document_package_url=v_signed.storage_path AND execution_certificate_url=v_certificate.storage_path) THEN
      RAISE EXCEPTION 'Executed record has inconsistent final artifacts';
    END IF;
    RETURN p_execution_id;
  END IF;
  UPDATE public.executions SET status='executed',executed_at=now(),document_package_url=v_signed.storage_path,
    execution_certificate_url=v_certificate.storage_path,sha_hash=v_signed.content_sha256,updated_at=now() WHERE id=p_execution_id;
  INSERT INTO public.execution_events(execution_id,event_type,event_data) VALUES(p_execution_id,'executed',jsonb_build_object(
    'document_version_id',p_document_version_id,'manifest_sha256',v_hash,'signed_pdf_artifact_id',v_signed.id,
    'signed_pdf_sha256',v_signed.content_sha256,'certificate_artifact_id',v_certificate.id,'certificate_sha256',v_certificate.content_sha256));
  RETURN p_execution_id;
END;
$function$;

-- Table writes belong exclusively to the governed functions above.
REVOKE INSERT,UPDATE,DELETE ON public.execution_final_artifacts FROM service_role;
COMMIT;
