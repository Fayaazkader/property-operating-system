BEGIN;

CREATE OR REPLACE FUNCTION public.lock_governed_execution_for_preparation(
  p_execution_id uuid,
  p_actor_id uuid
)
RETURNS TABLE (
  execution_id uuid,
  document_version_id uuid,
  entity_id uuid,
  source_document_id uuid,
  source_checksum text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
  v_source public.documents%ROWTYPE;
  v_opportunity public.leasing_opportunities%ROWTYPE;
  v_provenance public.lease_generated_document_provenance%ROWTYPE;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_execution_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Invalid execution preparation request';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions AS execution_row
  WHERE execution_row.id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.source_type <> 'leasing_opportunity'
     OR v_execution.status NOT IN ('under_review', 'ready')
     OR v_execution.metadata->>'governed_generated_lease' IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'Execution not eligible for preparation';
  END IF;

  SELECT *
  INTO v_version
  FROM public.execution_document_versions AS edv
  WHERE edv.execution_id = v_execution.id
    AND edv.version = v_execution.version
    AND edv.status = 'active'
  FOR UPDATE;

  IF NOT FOUND
     OR v_version.document_id IS NULL
     OR v_version.entity_id IS NULL
     OR v_version.document_checksum IS NULL
     OR v_version.document_checksum IS DISTINCT FROM v_execution.sha_hash
     OR v_version.snapshot IS DISTINCT FROM v_execution.snapshot
  THEN
    RAISE EXCEPTION 'Frozen execution version mismatch';
  END IF;

  IF NOT COALESCE(
    public.has_entity_permission(
      p_actor_id,
      v_version.entity_id,
      'leasing.execution.send'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'Execution preparation permission denied';
  END IF;

  SELECT *
  INTO v_opportunity
  FROM public.leasing_opportunities AS opportunity
  WHERE opportunity.id = v_execution.source_id
    AND opportunity.entity_id = v_version.entity_id
  FOR SHARE;

  IF NOT FOUND
     OR v_opportunity.approved_terms_version_id IS NULL
     OR v_opportunity.approved_terms_version_id::text
          IS DISTINCT FROM v_execution.snapshot->>'commercial_version_id'
  THEN
    RAISE EXCEPTION 'Execution commercial authority mismatch';
  END IF;

  SELECT *
  INTO v_source
  FROM public.documents AS source_document
  WHERE source_document.id = v_version.document_id
    AND source_document.entity_id = v_version.entity_id;

  IF NOT FOUND
     OR v_source.document_type <> 'generated_lease'
     OR v_source.checksum IS DISTINCT FROM v_version.document_checksum
     OR v_execution.snapshot->>'generated_document_id'
          IS DISTINCT FROM v_source.id::text
     OR v_execution.snapshot->>'generated_document_checksum'
          IS DISTINCT FROM v_source.checksum
  THEN
    RAISE EXCEPTION 'Approved execution source mismatch';
  END IF;

  SELECT *
  INTO v_provenance
  FROM public.lease_generated_document_provenance AS provenance
  WHERE provenance.id = v_version.generated_lease_provenance_id
    AND provenance.entity_id = v_version.entity_id
    AND provenance.opportunity_id = v_execution.source_id
    AND provenance.document_id = v_version.document_id;

  IF NOT FOUND
     OR v_provenance.commercial_version_id
          IS DISTINCT FROM v_opportunity.approved_terms_version_id
     OR v_provenance.generated_checksum
          IS DISTINCT FROM v_version.document_checksum
     OR v_execution.snapshot->>'template_id'
          IS DISTINCT FROM v_provenance.template_id::text
     OR v_execution.snapshot->>'template_version'
          IS DISTINCT FROM v_provenance.template_version::text
  THEN
    RAISE EXCEPTION 'Execution generation provenance mismatch';
  END IF;

  IF v_execution.is_locked IS DISTINCT FROM true THEN
    UPDATE public.executions AS execution_row
    SET is_locked = true,
        locked_at = now(),
        locked_by = p_actor_id
    WHERE execution_row.id = v_execution.id;
  END IF;

  RETURN QUERY
  SELECT
    v_execution.id,
    v_version.id,
    v_version.entity_id,
    v_version.document_id,
    v_version.document_checksum;
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_governed_execution_for_preparation(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lock_governed_execution_for_preparation(uuid, uuid)
TO service_role;

COMMIT;
