SET LOCAL ROLE service_role;

DO $test$
DECLARE
  f record;
  b record;
  l record;
  l2 record;
  e record;
  v record;
  prior_lock_time timestamptz;
BEGIN
  SELECT
    p.entity_id,
    p.opportunity_id,
    p.document_id,
    p.created_by AS actor_id,
    p.commercial_version_id,
    p.generated_checksum
  INTO f
  FROM public.lease_generated_document_provenance p
  JOIN public.leasing_opportunities lo
    ON lo.id = p.opportunity_id
   AND lo.entity_id = p.entity_id
   AND lo.approved_terms_version_id = p.commercial_version_id
  JOIN public.documents d
    ON d.id = p.document_id
   AND d.entity_id = p.entity_id
   AND d.document_type = 'generated_lease'
   AND d.checksum = p.generated_checksum
  WHERE public.has_entity_permission(
    p.created_by, p.entity_id, 'leasing.execution.send'
  )
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No eligible approved lease';
  END IF;

  SELECT *
  INTO b
  FROM public.approve_generated_lease_for_execution(
    f.entity_id, f.opportunity_id, f.document_id, f.actor_id
  );

  IF b.execution_id IS NULL THEN
    RAISE EXCEPTION 'Approval bridge returned no execution';
  END IF;

  RAISE NOTICE 'PASS: governed approval bridge';

  SELECT *
  INTO l
  FROM public.lock_governed_execution_for_preparation(
    b.execution_id, f.actor_id
  );

  IF l.execution_id IS DISTINCT FROM b.execution_id
     OR l.source_document_id IS DISTINCT FROM f.document_id
     OR l.source_checksum IS DISTINCT FROM f.generated_checksum
  THEN
    RAISE EXCEPTION 'Preparation returned incorrect source';
  END IF;

  SELECT * INTO e
  FROM public.executions
  WHERE id = b.execution_id;

  SELECT * INTO v
  FROM public.execution_document_versions
  WHERE id = l.document_version_id;

  IF e.is_locked IS DISTINCT FROM true
     OR e.locked_at IS NULL
     OR e.sha_hash IS DISTINCT FROM f.generated_checksum
     OR v.document_id IS DISTINCT FROM f.document_id
     OR v.snapshot IS DISTINCT FROM e.snapshot
     OR e.snapshot->>'commercial_version_id'
        IS DISTINCT FROM f.commercial_version_id::text
  THEN
    RAISE EXCEPTION 'Frozen execution governance mismatch';
  END IF;

  RAISE NOTICE 'PASS: frozen document and commercial authority';

  prior_lock_time := e.locked_at;

  SELECT *
  INTO l2
  FROM public.lock_governed_execution_for_preparation(
    b.execution_id, f.actor_id
  );

  IF l2.execution_id IS DISTINCT FROM l.execution_id
     OR l2.document_version_id IS DISTINCT FROM l.document_version_id
     OR l2.source_checksum IS DISTINCT FROM l.source_checksum
  THEN
    RAISE EXCEPTION 'Repeated preparation changed identifiers';
  END IF;

  SELECT * INTO e
  FROM public.executions
  WHERE id = b.execution_id;

  IF e.locked_at IS DISTINCT FROM prior_lock_time THEN
    RAISE EXCEPTION 'Repeated preparation changed lock timestamp';
  END IF;

  RAISE NOTICE 'PASS: preparation idempotency';
END;
$test$;

RESET ROLE;
