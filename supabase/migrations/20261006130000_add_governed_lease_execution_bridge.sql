-- Governed generated-lease -> execution bridge.
--
-- Invariant:
-- An execution created from AssetFlow lease generation must be bound to the
-- exact reviewed generated document and its immutable generation provenance.
-- Mutable lease/intake state must never replace that authority at send time.

ALTER TABLE public.execution_document_versions
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id),
  ADD COLUMN IF NOT EXISTS document_checksum text,
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id),
  ADD COLUMN IF NOT EXISTS generated_lease_provenance_id uuid
    REFERENCES public.lease_generated_document_provenance(id);

CREATE UNIQUE INDEX IF NOT EXISTS
  execution_document_versions_execution_document_uidx
ON public.execution_document_versions (execution_id, document_id)
WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  execution_document_versions_document_idx
ON public.execution_document_versions (document_id)
WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  execution_document_versions_entity_idx
ON public.execution_document_versions (entity_id)
WHERE entity_id IS NOT NULL;


-- Legacy executions historically captured the current mutable lease row when
-- transitioning to "sent". Governed executions already contain an immutable
-- authority snapshot and must never be overwritten by mutable lease state.
CREATE OR REPLACE FUNCTION public.capture_execution_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sent'
     AND OLD.status IS DISTINCT FROM 'sent'
     AND COALESCE((NEW.metadata ->> 'governed_generated_lease')::boolean, false) = false
  THEN
    NEW.snapshot = (
      SELECT row_to_json(source)
      FROM (
        SELECT *
        FROM public.leases
        WHERE id = NEW.source_id
      ) source
    );
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_generated_lease_for_execution(
  p_entity_id uuid,
  p_opportunity_id uuid,
  p_document_id uuid,
  p_actor_id uuid
)
RETURNS TABLE (
  execution_id uuid,
  document_id uuid,
  document_checksum text,
  execution_status text,
  execution_locked boolean,
  commercial_version_id uuid,
  template_id uuid,
  template_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_provenance public.lease_generated_document_provenance%ROWTYPE;
  v_opportunity public.leasing_opportunities%ROWTYPE;
  v_execution public.executions%ROWTYPE;
  v_existing_version public.execution_document_versions%ROWTYPE;
  v_has_permission boolean := false;
BEGIN
  IF p_entity_id IS NULL
     OR p_opportunity_id IS NULL
     OR p_document_id IS NULL
     OR p_actor_id IS NULL
  THEN
    RAISE EXCEPTION 'execution_bridge_invalid_input';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'execution_bridge_actor_mismatch';
  END IF;

  SELECT COALESCE(public.has_entity_permission(
    p_actor_id,
    p_entity_id,
    'leasing.execution.send'
  ), false)
  INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'execution_bridge_permission_denied';
  END IF;

  SELECT *
  INTO v_opportunity
  FROM public.leasing_opportunities
  WHERE id = p_opportunity_id
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'execution_bridge_opportunity_not_found';
  END IF;

  IF v_opportunity.approved_terms_version_id IS NULL THEN
    RAISE EXCEPTION 'execution_bridge_terms_not_approved';
  END IF;

  SELECT *
  INTO v_document
  FROM public.documents
  WHERE id = p_document_id
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'execution_bridge_document_not_found';
  END IF;

  IF v_document.document_type IS DISTINCT FROM 'generated_lease' THEN
    RAISE EXCEPTION 'execution_bridge_wrong_document_type';
  END IF;

  IF v_document.checksum IS NULL OR btrim(v_document.checksum) = '' THEN
    RAISE EXCEPTION 'execution_bridge_document_checksum_missing';
  END IF;

  SELECT *
  INTO v_provenance
  FROM public.lease_generated_document_provenance
  WHERE entity_id = p_entity_id
    AND document_id = p_document_id
    AND opportunity_id = p_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'execution_bridge_provenance_not_found';
  END IF;

  IF v_provenance.commercial_version_id
       IS DISTINCT FROM v_opportunity.approved_terms_version_id
  THEN
    RAISE EXCEPTION 'execution_bridge_commercial_authority_changed';
  END IF;

  IF v_provenance.generated_checksum
       IS DISTINCT FROM v_document.checksum
  THEN
    RAISE EXCEPTION 'execution_bridge_checksum_mismatch';
  END IF;

  -- Idempotency: reuse an existing governed execution for this exact
  -- generated document where execution has not reached a terminal state.
  SELECT e.*
  INTO v_execution
  FROM public.executions e
  JOIN public.execution_document_versions edv
    ON edv.execution_id = e.id
  WHERE edv.document_id = p_document_id
    AND edv.entity_id = p_entity_id
    AND e.status NOT IN ('cancelled', 'expired')
  ORDER BY e.created_at DESC
  LIMIT 1
  FOR UPDATE OF e;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_execution.id,
      v_document.id,
      v_document.checksum,
      v_execution.status,
      v_execution.is_locked,
      v_provenance.commercial_version_id,
      v_provenance.template_id,
      v_provenance.template_version;
    RETURN;
  END IF;

  INSERT INTO public.executions (
    source_type,
    source_id,
    version,
    snapshot,
    status,
    provider,
    signing_method,
    signing_order,
    is_locked,
    locked_at,
    locked_by,
    ready_score,
    validation_checks,
    document_package_url,
    sha_hash,
    metadata,
    created_by
  )
  VALUES (
    'leasing_opportunity',
    p_opportunity_id,
    1,
    jsonb_build_object(
      'authority', 'generated_lease',
      'entity_id', p_entity_id,
      'opportunity_id', p_opportunity_id,
      'commercial_version_id', v_provenance.commercial_version_id,
      'template_id', v_provenance.template_id,
      'template_version', v_provenance.template_version,
      'template_source_document_id', v_provenance.template_source_document_id,
      'template_source_checksum', v_provenance.template_source_checksum,
      'generated_document_id', v_document.id,
      'generated_document_checksum', v_document.checksum,
      'approved_for_execution_by', p_actor_id,
      'approved_for_execution_at', now()
    ),
    'under_review',
    'native',
    'standard',
    'sequential',
    false,
    NULL,
    NULL,
    0,
    '[]'::jsonb,
    v_document.storage_key,
    v_document.checksum,
    jsonb_build_object(
      'governed_generated_lease', true,
      'entity_id', p_entity_id,
      'opportunity_id', p_opportunity_id,
      'generated_document_id', v_document.id
    ),
    p_actor_id
  )
  RETURNING *
  INTO v_execution;

  INSERT INTO public.execution_document_versions (
    execution_id,
    version,
    document_url,
    snapshot,
    status,
    created_by,
    document_id,
    document_checksum,
    entity_id,
    generated_lease_provenance_id
  )
  VALUES (
    v_execution.id,
    1,
    v_document.storage_key,
    v_execution.snapshot,
    'active',
    p_actor_id,
    v_document.id,
    v_document.checksum,
    p_entity_id,
    v_provenance.id
  )
  RETURNING *
  INTO v_existing_version;

  UPDATE public.documents
  SET
    status = 'approved',
    requires_review = false,
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_document_id;

  INSERT INTO public.execution_events (
    execution_id,
    event_type,
    event_data,
    created_by
  )
  VALUES (
    v_execution.id,
    'review_completed',
    jsonb_build_object(
      'document_id', v_document.id,
      'document_checksum', v_document.checksum,
      'commercial_version_id', v_provenance.commercial_version_id,
      'template_id', v_provenance.template_id,
      'template_version', v_provenance.template_version
    ),
    p_actor_id
  );

  RETURN QUERY
  SELECT
    v_execution.id,
    v_document.id,
    v_document.checksum,
    v_execution.status,
    v_execution.is_locked,
    v_provenance.commercial_version_id,
    v_provenance.template_id,
    v_provenance.template_version;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_generated_lease_for_execution(
  uuid, uuid, uuid, uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_generated_lease_for_execution(
  uuid, uuid, uuid, uuid
) FROM anon;

REVOKE ALL ON FUNCTION public.approve_generated_lease_for_execution(
  uuid, uuid, uuid, uuid
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.approve_generated_lease_for_execution(
  uuid, uuid, uuid, uuid
) TO service_role;
