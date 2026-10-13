BEGIN;

CREATE OR REPLACE FUNCTION public.nominate_execution_signatories(
  p_entity_id uuid,
  p_execution_id uuid,
  p_actor_id uuid,
  p_tenant_name text,
  p_tenant_email text,
  p_landlord_name text,
  p_landlord_email text
)
RETURNS TABLE (
  tenant_participant_id uuid,
  landlord_participant_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_tenant_email text;
  v_landlord_email text;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_entity_id IS NULL
     OR p_execution_id IS NULL
     OR p_actor_id IS NULL
     OR NOT COALESCE(
       public.has_entity_permission(
         p_actor_id, p_entity_id, 'leasing.execution.send'
       ), false
     ) THEN
    RAISE EXCEPTION 'Execution nomination permission denied';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Execution actor mismatch';
  END IF;

  v_tenant_email := lower(btrim(COALESCE(p_tenant_email, '')));
  v_landlord_email := lower(btrim(COALESCE(p_landlord_email, '')));

  IF length(btrim(COALESCE(p_tenant_name, ''))) NOT BETWEEN 2 AND 200
     OR length(btrim(COALESCE(p_landlord_name, ''))) NOT BETWEEN 2 AND 200
     OR length(v_tenant_email) NOT BETWEEN 3 AND 254
     OR length(v_landlord_email) NOT BETWEEN 3 AND 254
     OR v_tenant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_landlord_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR v_tenant_email = v_landlord_email THEN
    RAISE EXCEPTION 'Invalid or duplicate signatory details';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions AS e
  WHERE e.id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.source_type IS DISTINCT FROM 'leasing_opportunity'
     OR v_execution.source_id IS NULL
     OR v_execution.status IS DISTINCT FROM 'under_review'
     OR v_execution.is_locked IS DISTINCT FROM true
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.signing_order IS DISTINCT FROM 'sequential'
     OR v_execution.sha_hash IS NULL THEN
    RAISE EXCEPTION 'Execution is not eligible for nomination';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leasing_opportunities o
    WHERE o.id = v_execution.source_id
      AND o.entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Execution entity mismatch';
  END IF;

  SELECT *
  INTO v_version
  FROM public.execution_document_versions AS dv
  WHERE dv.execution_id = p_execution_id
    AND dv.version = v_execution.version
    AND dv.status = 'active'
    AND dv.entity_id = p_entity_id
    AND dv.document_checksum = v_execution.sha_hash
  FOR UPDATE;

  IF NOT FOUND OR v_version.document_id IS NULL THEN
    RAISE EXCEPTION 'Approved document version missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_signing_documents sd
    WHERE sd.execution_id = p_execution_id
      AND sd.document_version_id = v_version.id
      AND sd.entity_id = p_entity_id
      AND sd.source_document_id = v_version.document_id
      AND sd.source_checksum = v_version.document_checksum
      AND sd.status = 'committed'
      AND sd.committed_at IS NOT NULL
      AND sd.pdf_checksum ~ '^[a-f0-9]{64}$'
      AND sd.page_count > 0
      AND sd.content_length > 0
  ) THEN
    RAISE EXCEPTION 'Committed signing PDF required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.execution_participants AS ep
    WHERE ep.execution_id = p_execution_id
  ) OR EXISTS (
    SELECT 1 FROM public.execution_signing_invitations AS esi
    WHERE esi.execution_id = p_execution_id
  ) THEN
    RAISE EXCEPTION 'Execution signatory manifest already established';
  END IF;

  INSERT INTO public.execution_participants (
    execution_id, participant_type, name, email, signing_order, status
  ) VALUES (
    p_execution_id, 'tenant', btrim(p_tenant_name),
    v_tenant_email, 1, 'pending'
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.execution_participants (
    execution_id, participant_type, name, email, signing_order, status
  ) VALUES (
    p_execution_id, 'landlord', btrim(p_landlord_name),
    v_landlord_email, 2, 'pending'
  )
  RETURNING id INTO v_landlord_id;

  INSERT INTO public.execution_events (
    execution_id, event_type, event_data, created_by
  ) VALUES (
    p_execution_id,
    'signatories_nominated',
    jsonb_build_object(
      'tenant_participant_id', v_tenant_id,
      'landlord_participant_id', v_landlord_id,
      'document_version_id', v_version.id,
      'signing_order', 'sequential'
    ),
    p_actor_id
  );

  tenant_participant_id := v_tenant_id;
  landlord_participant_id := v_landlord_id;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_execution_ready_for_signing(
  p_entity_id uuid,
  p_execution_id uuid,
  p_actor_id uuid
)
RETURNS TABLE (
  execution_id uuid,
  execution_status text,
  document_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_version public.execution_document_versions%ROWTYPE;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_entity_id IS NULL
     OR p_execution_id IS NULL
     OR p_actor_id IS NULL
     OR NOT COALESCE(
       public.has_entity_permission(
         p_actor_id, p_entity_id, 'leasing.execution.send'
       ), false
     ) THEN
    RAISE EXCEPTION 'Execution readiness permission denied';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Execution actor mismatch';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions AS e
  WHERE e.id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.source_type IS DISTINCT FROM 'leasing_opportunity'
     OR v_execution.status IS DISTINCT FROM 'under_review'
     OR v_execution.is_locked IS DISTINCT FROM true
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.signing_order IS DISTINCT FROM 'sequential'
     OR v_execution.sha_hash IS NULL THEN
    RAISE EXCEPTION 'Execution is not eligible for readiness';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leasing_opportunities o
    WHERE o.id = v_execution.source_id
      AND o.entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Execution entity mismatch';
  END IF;

  SELECT *
  INTO v_version
  FROM public.execution_document_versions AS dv
  WHERE dv.execution_id = p_execution_id
    AND dv.version = v_execution.version
    AND dv.status = 'active'
    AND dv.entity_id = p_entity_id
    AND dv.document_checksum = v_execution.sha_hash
  FOR UPDATE;

  IF NOT FOUND OR v_version.document_id IS NULL THEN
    RAISE EXCEPTION 'Active document version missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.execution_signing_documents sd
    WHERE sd.execution_id = p_execution_id
      AND sd.document_version_id = v_version.id
      AND sd.entity_id = p_entity_id
      AND sd.source_document_id = v_version.document_id
      AND sd.source_checksum = v_version.document_checksum
      AND sd.status = 'committed'
      AND sd.committed_at IS NOT NULL
      AND sd.pdf_checksum ~ '^[a-f0-9]{64}$'
      AND sd.page_count > 0
      AND sd.content_length > 0
  ) THEN
    RAISE EXCEPTION 'Committed signing PDF missing';
  END IF;

  IF (SELECT count(*) FROM public.execution_participants AS ep
      WHERE ep.execution_id = p_execution_id) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.execution_participants AS ep
       WHERE ep.execution_id = p_execution_id
         AND participant_type = 'tenant'
         AND signing_order = 1
         AND status = 'pending'
         AND signed_at IS NULL
         AND NULLIF(btrim(name), '') IS NOT NULL
         AND NULLIF(btrim(email), '') IS NOT NULL
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.execution_participants AS ep
       WHERE ep.execution_id = p_execution_id
         AND participant_type = 'landlord'
         AND signing_order = 2
         AND status = 'pending'
         AND signed_at IS NULL
         AND NULLIF(btrim(name), '') IS NOT NULL
         AND NULLIF(btrim(email), '') IS NOT NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.execution_signing_invitations AS esi
       WHERE esi.execution_id = p_execution_id
     ) THEN
    RAISE EXCEPTION 'Execution signatory manifest is incomplete or modified';
  END IF;

  UPDATE public.executions AS e
  SET status = 'ready',
      ready_score = 100,
      validation_checks = jsonb_build_array(
        'committed_signing_pdf',
        'tenant_signatory',
        'landlord_signatory',
        'sequential_signing'
      ),
      updated_at = now()
  WHERE e.id = p_execution_id;

  INSERT INTO public.execution_events (
    execution_id, event_type, event_data, created_by
  ) VALUES (
    p_execution_id,
    'execution_ready_for_signing',
    jsonb_build_object(
      'document_version_id', v_version.id,
      'document_checksum', v_version.document_checksum,
      'participant_count', 2
    ),
    p_actor_id
  );

  execution_id := p_execution_id;
  execution_status := 'ready';
  document_version_id := v_version.id;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.nominate_execution_signatories(
  uuid,uuid,uuid,text,text,text,text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.nominate_execution_signatories(
  uuid,uuid,uuid,text,text,text,text
) TO service_role;

REVOKE ALL ON FUNCTION public.mark_execution_ready_for_signing(
  uuid,uuid,uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mark_execution_ready_for_signing(
  uuid,uuid,uuid
) TO service_role;

COMMIT;
