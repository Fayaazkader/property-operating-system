BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'execution-documents',
  'execution-documents',
  false,
  31457280,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.execution_signing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id uuid NOT NULL
    REFERENCES public.executions(id) ON DELETE RESTRICT,

  document_version_id uuid NOT NULL
    REFERENCES public.execution_document_versions(id) ON DELETE RESTRICT,

  entity_id uuid NOT NULL,

  source_document_id uuid NOT NULL
    REFERENCES public.documents(id) ON DELETE RESTRICT,

  source_checksum text NOT NULL
    CHECK (source_checksum ~ '^[a-f0-9]{64}$'),

  pdf_checksum text NOT NULL
    CHECK (pdf_checksum ~ '^[a-f0-9]{64}$'),

  bucket_id text NOT NULL DEFAULT 'execution-documents'
    CHECK (bucket_id = 'execution-documents'),

  storage_path text NOT NULL UNIQUE,

  page_count integer NOT NULL
    CHECK (page_count BETWEEN 1 AND 500),

  content_length bigint NOT NULL
    CHECK (content_length BETWEEN 1 AND 31457280),

  conversion_provider text NOT NULL
    CHECK (conversion_provider IN ('original-pdf', 'gotenberg')),

  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'committed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,

  CONSTRAINT execution_signing_documents_commit_check
    CHECK (
      (status = 'staged' AND committed_at IS NULL)
      OR
      (status = 'committed' AND committed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX execution_signing_documents_committed_version_uidx
  ON public.execution_signing_documents (document_version_id)
  WHERE status = 'committed';

CREATE INDEX execution_signing_documents_execution_idx
  ON public.execution_signing_documents (
    execution_id,
    document_version_id,
    created_at DESC
  );

CREATE FUNCTION public.protect_execution_signing_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_setting(
      'assetflow.execution_document_write',
      true
    ) IS DISTINCT FROM 'stage' THEN
      RAISE EXCEPTION 'Governed registration required';
    END IF;

    IF NEW.status <> 'staged' OR NEW.committed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Signing documents must be staged initially';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Execution signing document cannot be deleted';
  END IF;

  IF current_setting(
    'assetflow.execution_document_write',
    true
  ) IS DISTINCT FROM 'commit' THEN
    RAISE EXCEPTION 'Governed commit required';
  END IF;

  IF OLD.status = 'committed' THEN
    RAISE EXCEPTION 'Committed execution signing document is immutable';
  END IF;

  IF ROW(
    NEW.execution_id,
    NEW.document_version_id,
    NEW.entity_id,
    NEW.source_document_id,
    NEW.source_checksum,
    NEW.pdf_checksum,
    NEW.bucket_id,
    NEW.storage_path,
    NEW.page_count,
    NEW.content_length,
    NEW.conversion_provider,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.execution_id,
    OLD.document_version_id,
    OLD.entity_id,
    OLD.source_document_id,
    OLD.source_checksum,
    OLD.pdf_checksum,
    OLD.bucket_id,
    OLD.storage_path,
    OLD.page_count,
    OLD.content_length,
    OLD.conversion_provider,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Execution signing document identity is immutable';
  END IF;

  IF NEW.status <> 'committed'
     OR NEW.committed_at IS NULL
     OR OLD.status <> 'staged'
     OR OLD.committed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid execution signing document transition';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER execution_signing_documents_protect
BEFORE INSERT OR UPDATE OR DELETE
ON public.execution_signing_documents
FOR EACH ROW
EXECUTE FUNCTION public.protect_execution_signing_documents();

ALTER TABLE public.execution_signing_documents
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.execution_signing_documents
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON public.execution_signing_documents
TO service_role;

CREATE OR REPLACE FUNCTION public.stage_execution_signing_document(
  p_execution_id uuid,
  p_document_version_id uuid,
  p_entity_id uuid,
  p_source_document_id uuid,
  p_source_checksum text,
  p_pdf_checksum text,
  p_storage_path text,
  p_page_count integer,
  p_content_length bigint,
  p_conversion_provider text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
  v_source public.documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_source_checksum !~ '^[a-f0-9]{64}$'
     OR p_pdf_checksum !~ '^[a-f0-9]{64}$'
     OR p_storage_path IS NULL
     OR p_storage_path !~ '^[a-zA-Z0-9/_-]+[.]pdf$'
     OR p_page_count NOT BETWEEN 1 AND 500
     OR p_content_length NOT BETWEEN 1 AND 31457280
     OR p_conversion_provider NOT IN ('original-pdf', 'gotenberg') THEN
    RAISE EXCEPTION 'Invalid signing PDF metadata';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.is_locked IS DISTINCT FROM true
     OR v_execution.status NOT IN ('under_review', 'ready') THEN
    RAISE EXCEPTION 'Execution not eligible for PDF preparation';
  END IF;

  SELECT *
  INTO v_version
  FROM public.execution_document_versions
  WHERE id = p_document_version_id
    AND execution_id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_version.status <> 'active'
     OR v_version.version IS DISTINCT FROM v_execution.version
     OR v_version.entity_id IS DISTINCT FROM p_entity_id
     OR v_version.document_id IS DISTINCT FROM p_source_document_id
     OR v_version.document_checksum IS DISTINCT FROM p_source_checksum
     OR v_execution.sha_hash IS DISTINCT FROM p_source_checksum THEN
    RAISE EXCEPTION 'Frozen execution source mismatch';
  END IF;

  SELECT *
  INTO v_source
  FROM public.documents
  WHERE id = p_source_document_id
    AND entity_id = p_entity_id;

  IF NOT FOUND
     OR v_source.checksum IS DISTINCT FROM p_source_checksum THEN
    RAISE EXCEPTION 'Source document provenance mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.execution_signing_documents
    WHERE document_version_id = p_document_version_id
      AND status = 'committed'
  ) THEN
    RAISE EXCEPTION 'Signing PDF already committed';
  END IF;

  PERFORM pg_catalog.set_config(
    'assetflow.execution_document_write',
    'stage',
    true
  );

  INSERT INTO public.execution_signing_documents (
    execution_id,
    document_version_id,
    entity_id,
    source_document_id,
    source_checksum,
    pdf_checksum,
    storage_path,
    page_count,
    content_length,
    conversion_provider
  )
  VALUES (
    p_execution_id,
    p_document_version_id,
    p_entity_id,
    p_source_document_id,
    p_source_checksum,
    p_pdf_checksum,
    p_storage_path,
    p_page_count,
    p_content_length,
    p_conversion_provider
  )
  RETURNING id INTO v_id;

  PERFORM pg_catalog.set_config(
    'assetflow.execution_document_write',
    '',
    true
  );

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.stage_execution_signing_document(
  uuid, uuid, uuid, uuid, text, text, text, integer, bigint, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stage_execution_signing_document(
  uuid, uuid, uuid, uuid, text, text, text, integer, bigint, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_execution_signing_document(
  p_document_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_identity record;
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
  v_document public.execution_signing_documents%ROWTYPE;
  v_source public.documents%ROWTYPE;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  -- Establish the canonical execution lock before locking dependent rows.
  SELECT execution_id, document_version_id
  INTO v_identity
  FROM public.execution_signing_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signing document not found';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = v_identity.execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.status NOT IN ('under_review', 'ready')
     OR v_execution.is_locked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Execution cannot prepare signing document';
  END IF;

  SELECT *
  INTO v_version
  FROM public.execution_document_versions
  WHERE id = v_identity.document_version_id
    AND execution_id = v_execution.id
  FOR UPDATE;

  IF NOT FOUND
     OR v_version.status <> 'active'
     OR v_version.version IS DISTINCT FROM v_execution.version
     OR v_version.document_checksum IS DISTINCT FROM v_execution.sha_hash THEN
    RAISE EXCEPTION 'Frozen source version mismatch';
  END IF;

  SELECT *
  INTO v_document
  FROM public.execution_signing_documents
  WHERE id = p_document_id
    AND execution_id = v_execution.id
    AND document_version_id = v_version.id
  FOR UPDATE;

  IF NOT FOUND
     OR v_document.status <> 'staged'
     OR v_document.committed_at IS NOT NULL
     OR v_document.source_document_id IS DISTINCT FROM v_version.document_id
     OR v_document.source_checksum IS DISTINCT FROM v_version.document_checksum
     OR v_document.entity_id IS DISTINCT FROM v_version.entity_id THEN
    RAISE EXCEPTION 'Signing document provenance mismatch';
  END IF;

  SELECT *
  INTO v_source
  FROM public.documents
  WHERE id = v_document.source_document_id
    AND entity_id = v_document.entity_id;

  IF NOT FOUND
     OR v_source.checksum IS DISTINCT FROM v_document.source_checksum THEN
    RAISE EXCEPTION 'Approved source document mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.execution_signing_documents existing
    WHERE existing.document_version_id = v_version.id
      AND existing.status = 'committed'
  ) THEN
    RAISE EXCEPTION 'Signing document already committed';
  END IF;

  PERFORM pg_catalog.set_config(
    'assetflow.execution_document_write',
    'commit',
    true
  );

  UPDATE public.execution_signing_documents
  SET status = 'committed',
      committed_at = now()
  WHERE id = v_document.id;

  PERFORM pg_catalog.set_config(
    'assetflow.execution_document_write',
    '',
    true
  );

  RETURN v_document.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.commit_execution_signing_document(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.commit_execution_signing_document(uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.protect_execution_signing_documents()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.protect_execution_signing_documents()
TO service_role;

COMMIT;
