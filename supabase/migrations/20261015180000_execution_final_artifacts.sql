BEGIN;

CREATE TABLE public.execution_final_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id uuid NOT NULL
    REFERENCES public.executions(id) ON DELETE RESTRICT,

  document_version_id uuid NOT NULL
    REFERENCES public.execution_document_versions(id) ON DELETE RESTRICT,

  artifact_type text NOT NULL
    CHECK (artifact_type IN ('signed_pdf', 'execution_certificate')),

  bucket_id text NOT NULL DEFAULT 'execution-documents'
    CHECK (bucket_id = 'execution-documents'),

  storage_path text NOT NULL UNIQUE,

  content_sha256 text NOT NULL
    CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),

  content_length bigint NOT NULL
    CHECK (content_length BETWEEN 1 AND 31457280),

  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'committed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,

  CONSTRAINT execution_final_artifacts_commit_check
    CHECK (
      (status = 'staged' AND committed_at IS NULL)
      OR
      (status = 'committed' AND committed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX execution_final_artifacts_committed_uidx
  ON public.execution_final_artifacts (
    execution_id,
    document_version_id,
    artifact_type
  )
  WHERE status = 'committed';

CREATE INDEX execution_final_artifacts_execution_idx
  ON public.execution_final_artifacts (
    execution_id,
    document_version_id,
    status
  );

CREATE FUNCTION public.protect_execution_final_artifacts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Execution final artifacts cannot be deleted';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF current_setting(
      'assetflow.execution_final_artifact_write', true
    ) IS DISTINCT FROM 'stage' THEN
      RAISE EXCEPTION 'Governed final artifact registration required';
    END IF;

    IF NEW.status <> 'staged' OR NEW.committed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Final artifacts must be staged initially';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'committed' THEN
    RAISE EXCEPTION 'Committed final artifacts are immutable';
  END IF;

  IF current_setting(
    'assetflow.execution_final_artifact_write', true
  ) IS DISTINCT FROM 'commit' THEN
    RAISE EXCEPTION 'Governed final artifact commit required';
  END IF;

  IF ROW(
    NEW.id,
    NEW.execution_id,
    NEW.document_version_id,
    NEW.artifact_type,
    NEW.bucket_id,
    NEW.storage_path,
    NEW.content_sha256,
    NEW.content_length,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.execution_id,
    OLD.document_version_id,
    OLD.artifact_type,
    OLD.bucket_id,
    OLD.storage_path,
    OLD.content_sha256,
    OLD.content_length,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Final artifact identity is immutable';
  END IF;

  IF OLD.status <> 'staged'
     OR NEW.status <> 'committed'
     OR NEW.committed_at IS NULL THEN
    RAISE EXCEPTION 'Invalid final artifact transition';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER execution_final_artifacts_protect
BEFORE INSERT OR UPDATE OR DELETE
ON public.execution_final_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.protect_execution_final_artifacts();

ALTER TABLE public.execution_final_artifacts
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.execution_final_artifacts
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.execution_final_artifacts
  TO service_role;

REVOKE ALL ON FUNCTION public.protect_execution_final_artifacts()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.protect_execution_final_artifacts()
  TO service_role;


CREATE FUNCTION public.stage_execution_final_artifact(
  p_execution_id uuid,
  p_document_version_id uuid,
  p_artifact_type text,
  p_storage_path text,
  p_content_sha256 text,
  p_content_length bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT e.status
  INTO v_status
  FROM public.executions e
  JOIN public.execution_document_versions dv
    ON dv.execution_id = e.id
  WHERE e.id = p_execution_id
    AND dv.id = p_document_version_id
  FOR UPDATE OF e;

  IF NOT FOUND OR v_status <> 'partially_signed' THEN
    RAISE EXCEPTION 'Execution is not eligible for finalisation';
  END IF;

  IF p_artifact_type NOT IN ('signed_pdf', 'execution_certificate')
     OR p_storage_path IS NULL
     OR length(p_storage_path) = 0
     OR p_content_sha256 !~ '^[a-f0-9]{64}$'
     OR p_content_length NOT BETWEEN 1 AND 31457280 THEN
    RAISE EXCEPTION 'Invalid final artifact metadata';
  END IF;

  PERFORM set_config(
    'assetflow.execution_final_artifact_write',
    'stage',
    true
  );

  INSERT INTO public.execution_final_artifacts (
    execution_id,
    document_version_id,
    artifact_type,
    storage_path,
    content_sha256,
    content_length
  )
  VALUES (
    p_execution_id,
    p_document_version_id,
    p_artifact_type,
    p_storage_path,
    p_content_sha256,
    p_content_length
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.commit_execution_final_artifact(
  p_artifact_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_artifact public.execution_final_artifacts%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  -- Lock the parent execution first, consistently with signing operations.
  PERFORM 1
  FROM public.executions e
  WHERE e.id = (
    SELECT a.execution_id
    FROM public.execution_final_artifacts a
    WHERE a.id = p_artifact_id
  )
  FOR UPDATE;

  SELECT *
  INTO v_artifact
  FROM public.execution_final_artifacts
  WHERE id = p_artifact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Final artifact not found';
  END IF;

  IF v_artifact.status = 'committed' THEN
    RETURN v_artifact.id;
  END IF;

  IF v_artifact.status <> 'staged' THEN
    RAISE EXCEPTION 'Invalid final artifact state';
  END IF;

  PERFORM 1
  FROM public.executions e
  WHERE e.id = v_artifact.execution_id
    AND e.status = 'partially_signed'
    AND e.is_locked = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution is not eligible for finalisation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_participants p
    WHERE p.execution_id = v_artifact.execution_id
  ) OR EXISTS (
    SELECT 1
    FROM public.execution_participants p
    WHERE p.execution_id = v_artifact.execution_id
      AND (
        p.status IS DISTINCT FROM 'signed'
        OR NOT EXISTS (
          SELECT 1
          FROM public.execution_signature_evidence se
          WHERE se.execution_id = p.execution_id
            AND se.participant_id = p.id
            AND se.document_version_id = v_artifact.document_version_id
            AND se.status = 'committed'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Execution signatures are incomplete';
  END IF;

  PERFORM set_config(
    'assetflow.execution_final_artifact_write',
    'commit',
    true
  );

  UPDATE public.execution_final_artifacts
  SET status = 'committed',
      committed_at = now()
  WHERE id = p_artifact_id;

  RETURN p_artifact_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.stage_execution_final_artifact(
  uuid, uuid, text, text, text, bigint
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.commit_execution_final_artifact(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stage_execution_final_artifact(
  uuid, uuid, text, text, text, bigint
) TO service_role;

GRANT EXECUTE ON FUNCTION public.commit_execution_final_artifact(uuid)
  TO service_role;


CREATE FUNCTION public.complete_execution_finalisation(
  p_execution_id uuid,
  p_document_version_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_signed public.execution_final_artifacts%ROWTYPE;
  v_certificate public.execution_final_artifacts%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution not found';
  END IF;

  IF v_execution.status = 'executed' THEN
    IF EXISTS (
      SELECT 1
      FROM public.execution_final_artifacts
      WHERE execution_id = p_execution_id
        AND document_version_id = p_document_version_id
        AND status = 'committed'
      GROUP BY execution_id, document_version_id
      HAVING count(DISTINCT artifact_type) = 2
    ) THEN
      RETURN p_execution_id;
    END IF;

    RAISE EXCEPTION 'Executed record has inconsistent final artifacts';
  END IF;

  IF v_execution.status <> 'partially_signed'
     OR v_execution.is_locked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Execution is not eligible for completion';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_document_versions dv
    JOIN public.execution_signing_documents sd
      ON sd.document_version_id = dv.id
    WHERE dv.id = p_document_version_id
      AND dv.execution_id = p_execution_id
      AND sd.execution_id = p_execution_id
      AND sd.status = 'committed'
  ) THEN
    RAISE EXCEPTION 'Committed signing document not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_participants p
    WHERE p.execution_id = p_execution_id
  ) OR EXISTS (
    SELECT 1
    FROM public.execution_participants p
    WHERE p.execution_id = p_execution_id
      AND (
        p.status IS DISTINCT FROM 'signed'
        OR NOT EXISTS (
          SELECT 1
          FROM public.execution_signature_evidence se
          WHERE se.execution_id = p_execution_id
            AND se.participant_id = p.id
            AND se.document_version_id = p_document_version_id
            AND se.status = 'committed'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Execution signatures are incomplete';
  END IF;

  SELECT *
  INTO v_signed
  FROM public.execution_final_artifacts
  WHERE execution_id = p_execution_id
    AND document_version_id = p_document_version_id
    AND artifact_type = 'signed_pdf'
    AND status = 'committed';

  SELECT *
  INTO v_certificate
  FROM public.execution_final_artifacts
  WHERE execution_id = p_execution_id
    AND document_version_id = p_document_version_id
    AND artifact_type = 'execution_certificate'
    AND status = 'committed';

  IF v_signed.id IS NULL OR v_certificate.id IS NULL THEN
    RAISE EXCEPTION 'Both final artifacts must be committed';
  END IF;

  UPDATE public.executions
  SET status = 'executed',
      executed_at = now(),
      document_package_url = v_signed.storage_path,
      execution_certificate_url = v_certificate.storage_path,
      sha_hash = v_signed.content_sha256,
      updated_at = now()
  WHERE id = p_execution_id;

  INSERT INTO public.execution_events (
    execution_id,
    event_type,
    event_data
  )
  VALUES (
    p_execution_id,
    'executed',
    jsonb_build_object(
      'document_version_id', p_document_version_id,
      'signed_pdf_artifact_id', v_signed.id,
      'signed_pdf_sha256', v_signed.content_sha256,
      'certificate_artifact_id', v_certificate.id,
      'certificate_sha256', v_certificate.content_sha256
    )
  );

  RETURN p_execution_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_execution_finalisation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_execution_finalisation(uuid, uuid)
  TO service_role;

COMMIT;
