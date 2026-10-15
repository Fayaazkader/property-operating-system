BEGIN;

-- One canonical placement manifest per frozen document version. All fields are
-- mandatory; coordinates are normalized on the displayed crop box, top-left.
CREATE TABLE public.execution_field_manifests (
  document_version_id uuid PRIMARY KEY REFERENCES public.execution_document_versions(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES public.executions(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL,
  signing_document_id uuid NOT NULL REFERENCES public.execution_signing_documents(id) ON DELETE RESTRICT,
  pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'frozen')),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  frozen_at timestamptz,
  CHECK ((status = 'draft' AND frozen_at IS NULL) OR (status = 'frozen' AND frozen_at IS NOT NULL))
);
-- Do not silently invent placements for executions that already crossed send.
DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM public.executions WHERE source_type = 'leasing_opportunity'
    AND status IN ('ready','sent','viewed','partially_signed','executed','activated') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Existing advanced lease executions require governed manifest reconciliation before rollout';
  END IF;
END;
$block$;
CREATE INDEX execution_field_manifests_execution_idx ON public.execution_field_manifests(execution_id);
ALTER TABLE public.execution_field_manifests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.execution_field_manifests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.execution_field_manifests TO service_role;

CREATE FUNCTION public.protect_execution_field_manifest()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Execution field manifests cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'frozen' THEN
    RAISE EXCEPTION 'Frozen execution field manifest is immutable';
  END IF;
  IF current_setting('assetflow.execution_manifest_write', true) IS DISTINCT FROM 'governed' THEN
    RAISE EXCEPTION 'Governed field manifest command required';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER execution_field_manifest_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.execution_field_manifests FOR EACH ROW EXECUTE FUNCTION public.protect_execution_field_manifest();
REVOKE ALL ON FUNCTION public.protect_execution_field_manifest() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.save_execution_field_manifest(
  p_entity_id uuid, p_execution_id uuid, p_actor_id uuid,
  p_document_version_id uuid, p_pdf_sha256 text, p_fields jsonb,
  p_expected_revision integer
) RETURNS TABLE (manifest_sha256 text, revision integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
  v_pdf public.execution_signing_documents%ROWTYPE;
  v_old public.execution_field_manifests%ROWTYPE;
  v_field jsonb;
  v_ids text[] := ARRAY[]::text[];
  v_hash text;
  v_revision integer;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;
  IF p_entity_id IS NULL OR p_actor_id IS NULL OR
     (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) OR
     NOT COALESCE(public.has_entity_permission(p_actor_id, p_entity_id, 'leasing.execution.send'), false) THEN
    RAISE EXCEPTION 'Execution manifest permission denied';
  END IF;
  SELECT * INTO v_execution FROM public.executions WHERE id = p_execution_id FOR UPDATE;
  IF NOT FOUND OR v_execution.source_type IS DISTINCT FROM 'leasing_opportunity' OR
     v_execution.status IS DISTINCT FROM 'under_review' OR
     v_execution.is_locked IS DISTINCT FROM true OR v_execution.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Execution cannot edit signing fields';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leasing_opportunities o
    WHERE o.id = v_execution.source_id AND o.entity_id = p_entity_id) THEN
    RAISE EXCEPTION 'Execution entity mismatch';
  END IF;
  SELECT * INTO v_version FROM public.execution_document_versions dv
    WHERE dv.id = p_document_version_id AND dv.execution_id = p_execution_id
      AND dv.entity_id = p_entity_id AND dv.status = 'active'
      AND dv.version = v_execution.version AND dv.document_checksum = v_execution.sha_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active execution version required'; END IF;
  SELECT * INTO v_pdf FROM public.execution_signing_documents sd
    WHERE sd.execution_id = p_execution_id AND sd.document_version_id = v_version.id
      AND sd.entity_id = p_entity_id AND sd.status = 'committed' AND sd.committed_at IS NOT NULL
      AND sd.source_document_id = v_version.document_id AND sd.source_checksum = v_version.document_checksum;
  IF NOT FOUND OR p_pdf_sha256 IS DISTINCT FROM v_pdf.pdf_checksum THEN
    RAISE EXCEPTION 'Committed signing PDF mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.execution_signing_invitations WHERE execution_id = p_execution_id) THEN
    RAISE EXCEPTION 'Signing invitation already established';
  END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Signing fields must be an array';
  END IF;
  IF jsonb_array_length(p_fields) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Signing field count is invalid';
  END IF;
  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields) LOOP
    IF jsonb_typeof(v_field) IS DISTINCT FROM 'object' OR
       jsonb_typeof(v_field->'id') IS DISTINCT FROM 'string' OR
       (v_field->>'id') !~ '^[0-9a-f-]{36}$' OR
       (v_field->>'id') = ANY(v_ids) OR
       jsonb_typeof(v_field->'participantId') IS DISTINCT FROM 'string' OR
       jsonb_typeof(v_field->'type') IS DISTINCT FROM 'string' OR
       (v_field->>'type') NOT IN ('signature', 'initial', 'date') OR
       jsonb_typeof(v_field->'page') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_field->'x') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_field->'y') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_field->'width') IS DISTINCT FROM 'number' OR
       jsonb_typeof(v_field->'height') IS DISTINCT FROM 'number' OR
       (SELECT count(*) FROM jsonb_object_keys(v_field)) <> 8 THEN
      RAISE EXCEPTION 'Invalid or duplicate signing field';
    END IF;
    -- UUID casts reject malformed references; numeric checks precede integer casts.
    PERFORM (v_field->>'id')::uuid;
    IF (v_field->>'page')::numeric <> trunc((v_field->>'page')::numeric) OR
       (v_field->>'page')::numeric NOT BETWEEN 1 AND v_pdf.page_count OR
       (v_field->>'x')::numeric < 0 OR (v_field->>'y')::numeric < 0 OR
       (v_field->>'width')::numeric <= 0 OR (v_field->>'height')::numeric <= 0 OR
       (v_field->>'x')::numeric + (v_field->>'width')::numeric > 1 OR
       (v_field->>'y')::numeric + (v_field->>'height')::numeric > 1 OR
       NOT EXISTS (SELECT 1 FROM public.execution_participants p
         WHERE p.id = (v_field->>'participantId')::uuid AND p.execution_id = p_execution_id
           AND p.status = 'pending' AND p.signed_at IS NULL) THEN
      RAISE EXCEPTION 'Invalid signing field geometry or participant';
    END IF;
    v_ids := array_append(v_ids, v_field->>'id');
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.execution_participants WHERE execution_id = p_execution_id) OR
     EXISTS (SELECT 1 FROM public.execution_participants p WHERE p.execution_id = p_execution_id
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_fields) f
         WHERE (f->>'participantId')::uuid = p.id AND f->>'type' = 'signature')) THEN
    RAISE EXCEPTION 'Every participant requires a signature field';
  END IF;
  SELECT * INTO v_old FROM public.execution_field_manifests m WHERE m.document_version_id = v_version.id FOR UPDATE;
  v_revision := COALESCE(v_old.revision, 0);
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'executionId', p_execution_id, 'documentVersionId', v_version.id,
    'originalSha256', v_pdf.pdf_checksum, 'fields', p_fields
  )::text, 'UTF8')), 'hex');
  IF v_old.manifest_sha256 = v_hash AND v_old.status = 'draft' AND
     p_expected_revision IN (v_revision, v_revision - 1) THEN
    -- Exact retry after a lost response; no extra revision or audit event.
    RETURN QUERY SELECT v_hash, v_revision;
    RETURN;
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision <> v_revision THEN
    RAISE EXCEPTION 'Signing manifest revision conflict';
  END IF;
  v_revision := v_revision + 1;
  PERFORM set_config('assetflow.execution_manifest_write', 'governed', true);
  INSERT INTO public.execution_field_manifests AS m (
    execution_id, entity_id, document_version_id, signing_document_id, pdf_sha256,
    fields, manifest_sha256, revision, created_by, updated_by
  ) VALUES (p_execution_id, p_entity_id, v_version.id, v_pdf.id, v_pdf.pdf_checksum,
    p_fields, v_hash, v_revision, p_actor_id, p_actor_id)
  ON CONFLICT (document_version_id) DO UPDATE SET fields = EXCLUDED.fields,
    manifest_sha256 = EXCLUDED.manifest_sha256, revision = EXCLUDED.revision,
    updated_by = EXCLUDED.updated_by, updated_at = now();
  PERFORM set_config('assetflow.execution_manifest_write', '', true);
  INSERT INTO public.execution_events(execution_id, event_type, event_data, created_by)
    VALUES (p_execution_id, 'signing_fields_saved', jsonb_build_object(
      'document_version_id', v_version.id, 'manifest_sha256', v_hash, 'revision', v_revision), p_actor_id);
  RETURN QUERY SELECT v_hash, v_revision;
END;
$function$;
REVOKE ALL ON FUNCTION public.save_execution_field_manifest(uuid,uuid,uuid,uuid,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_execution_field_manifest(uuid,uuid,uuid,uuid,text,jsonb,integer) TO service_role;

-- Apply to the canonical readiness RPC and any other attempted state transition.
-- The parent execution is already locked by the UPDATE/RPC, then manifest locks.
CREATE FUNCTION public.freeze_execution_field_manifest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_manifest public.execution_field_manifests%ROWTYPE;
BEGIN
  IF NEW.source_type IS DISTINCT FROM 'leasing_opportunity' OR
     NEW.status NOT IN ('ready', 'sent', 'viewed', 'partially_signed', 'executed', 'activated') THEN
    RETURN NEW;
  END IF;
  SELECT m.* INTO v_manifest FROM public.execution_field_manifests m
    JOIN public.execution_document_versions dv ON dv.id = m.document_version_id
    JOIN public.execution_signing_documents sd ON sd.id = m.signing_document_id
    JOIN public.leasing_opportunities o ON o.id = NEW.source_id
    WHERE m.execution_id = NEW.id AND m.entity_id = o.entity_id
      AND dv.execution_id = NEW.id AND dv.entity_id = m.entity_id
      AND dv.version = NEW.version AND dv.status = 'active'
      AND (dv.document_checksum = NEW.sha_hash OR
        (NEW.status IN ('executed','activated') AND EXISTS (
          SELECT 1 FROM public.execution_final_artifacts a
          WHERE a.execution_id = NEW.id AND a.document_version_id = dv.id
            AND a.artifact_type = 'signed_pdf' AND a.status = 'committed'
            AND a.content_sha256 = NEW.sha_hash)))
      AND sd.execution_id = NEW.id AND sd.document_version_id = dv.id AND sd.entity_id = m.entity_id
      AND sd.status = 'committed' AND sd.pdf_checksum = m.pdf_sha256
    FOR UPDATE OF m;
  IF NOT FOUND OR NEW.is_locked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Bound signing field manifest required';
  END IF;
  IF NEW.status IN ('executed','activated') AND NOT EXISTS (
    SELECT 1 FROM public.execution_final_artifacts signed
    JOIN public.execution_final_artifacts certificate ON certificate.execution_id = signed.execution_id
      AND certificate.document_version_id = signed.document_version_id
    WHERE signed.execution_id = NEW.id AND signed.document_version_id = v_manifest.document_version_id
      AND signed.artifact_type = 'signed_pdf' AND signed.status = 'committed'
      AND signed.content_sha256 = NEW.sha_hash AND signed.storage_path = NEW.document_package_url
      AND certificate.artifact_type = 'execution_certificate' AND certificate.status = 'committed'
      AND certificate.storage_path = NEW.execution_certificate_url
  ) THEN RAISE EXCEPTION 'Committed final artifacts required for executed state'; END IF;
  IF v_manifest.status = 'draft' THEN
    IF OLD.status IS DISTINCT FROM 'under_review' OR NEW.status IS DISTINCT FROM 'ready' THEN
      RAISE EXCEPTION 'Signing manifest must freeze at readiness';
    END IF;
    PERFORM set_config('assetflow.execution_manifest_write', 'governed', true);
    UPDATE public.execution_field_manifests SET status = 'frozen', frozen_at = now()
      WHERE document_version_id = v_manifest.document_version_id;
    PERFORM set_config('assetflow.execution_manifest_write', '', true);
    INSERT INTO public.execution_events(execution_id, event_type, event_data)
      VALUES (NEW.id, 'signing_fields_frozen', jsonb_build_object(
        'document_version_id', v_manifest.document_version_id,
        'manifest_sha256', v_manifest.manifest_sha256, 'revision', v_manifest.revision));
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER execution_field_readiness_guard BEFORE INSERT OR UPDATE
ON public.executions FOR EACH ROW EXECUTE FUNCTION public.freeze_execution_field_manifest();
REVOKE ALL ON FUNCTION public.freeze_execution_field_manifest() FROM PUBLIC, anon, authenticated;

COMMIT;
