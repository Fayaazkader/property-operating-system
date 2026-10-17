BEGIN;

-- One current/open financial period and one advance-postable successor.
-- Statement-period governance remains unchanged.

ALTER TABLE public.financial_periods
  DROP CONSTRAINT chk_valid_phase_combination,
  DROP CONSTRAINT financial_periods_status_check;

ALTER TABLE public.financial_periods
  ADD CONSTRAINT financial_periods_status_check
    CHECK (status IN ('open','advance','closing','closed')),
  ADD CONSTRAINT chk_valid_phase_combination
    CHECK (
      (status='open' AND workflow_phase IN (
        'open','receipting','allocation','billing_requested',
        'billing_running','billing_complete','exception_review',
        'ready_to_close'
      ))
      OR (status='advance' AND workflow_phase='advance')
      OR (status='closed' AND workflow_phase='closed')
    );

-- Existing current periods receive an advance successor.
-- An unexpected existing successor blocks migration rather than
-- silently altering its financial authority.

DO $block$
DECLARE
  c record;
  n public.financial_periods%ROWTYPE;
  d date;
  e date;
  suffix text;
BEGIN
  FOR c IN
    SELECT *
    FROM public.financial_periods
    WHERE period_type='financial' AND status='open'
    ORDER BY entity_id,period_start
  LOOP
    IF c.period_start<>date_trunc('month',c.period_start)::date
       OR c.period_end<>(c.period_start+interval '1 month - 1 day')::date THEN
      RAISE EXCEPTION 'Non-calendar financial period for entity %',c.entity_id;
    END IF;

    d:=(c.period_start+interval '1 month')::date;
    e:=(d+interval '1 month - 1 day')::date;
    suffix:=CASE WHEN c.period_name ILIKE '% Financial'
      THEN ' Financial' ELSE '' END;

    SELECT * INTO n
    FROM public.financial_periods
    WHERE entity_id=c.entity_id
      AND period_type='financial'
      AND period_start=d
    FOR UPDATE;

    IF FOUND THEN
      IF n.status<>'advance' OR n.period_end<>e THEN
        RAISE EXCEPTION 'Conflicting next period for entity %',c.entity_id;
      END IF;
    ELSE
      INSERT INTO public.financial_periods(
        entity_id,period_type,period_name,period_start,
        period_end,status,workflow_phase
      )
      VALUES(
        c.entity_id,'financial',
        to_char(d,'FMMonth YYYY')||suffix,
        d,e,'advance','advance'
      );
    END IF;
  END LOOP;
END;
$block$;

-- Database-level authority. Lock current before target to
-- serialize posting with financial-period promotion.

CREATE OR REPLACE FUNCTION public.assert_financial_posting_period(
  p_entity_id uuid,p_period_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path=''
AS $function$
DECLARE
  c public.financial_periods%ROWTYPE;
  t public.financial_periods%ROWTYPE;
  d date;
BEGIN
  SELECT * INTO c
  FROM public.financial_periods
  WHERE entity_id=p_entity_id
    AND period_type='financial'
    AND status='open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No current open financial period';
  END IF;

  SELECT * INTO t
  FROM public.financial_periods
  WHERE id=p_period_id
    AND entity_id=p_entity_id
    AND period_type='financial'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial period unavailable for entity';
  END IF;

  IF t.id=c.id THEN RETURN; END IF;

  d:=(c.period_start+interval '1 month')::date;

  IF t.status='advance'
     AND t.period_start=d
     AND t.period_end=(d+interval '1 month - 1 day')::date THEN
    RETURN;
  END IF;

  RAISE EXCEPTION
    'Only current and immediately next financial periods permit posting';
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_financial_posting_period(uuid,uuid)
FROM PUBLIC,anon,authenticated;

-- Retain the complete existing atomic posting function.
-- Only replace its financial-period admission check.

CREATE OR REPLACE FUNCTION public.atomic_post_journal(p_journal jsonb,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_entity uuid:=(p_journal->>'entity_id')::uuid;v_period public.financial_periods%ROWTYPE;
 v_line jsonb;v_result uuid;v_prior public.journals%ROWTYPE;v_debit numeric;v_credit numeric;v_normal jsonb;v_existing jsonb;
BEGIN
 IF p_journal->>'source_event' IN ('lease_commencement_invoice','maintenance_supplier_invoice') THEN RAISE EXCEPTION 'Use governed invoice issuance'; END IF;
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' AND
   (auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),v_entity,'finance.journal.post'),false)) THEN RAISE EXCEPTION 'Journal posting permission denied'; END IF;
 IF v_entity IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)<2 OR
   NULLIF(p_journal->>'source_event','') IS NULL OR NULLIF(p_journal->>'source_id','') IS NULL THEN RAISE EXCEPTION 'Journal entity, lines and stable source required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended((p_journal->>'source_event')||':'||(p_journal->>'source_id'),0));
 SELECT * INTO v_prior FROM public.journals WHERE source_event=p_journal->>'source_event' AND source_id=p_journal->>'source_id';
 IF FOUND AND (v_prior.entity_id IS DISTINCT FROM v_entity OR v_prior.period_id IS DISTINCT FROM (p_journal->>'period_id')::uuid) THEN RAISE EXCEPTION 'Journal source authority mismatch'; END IF;
 PERFORM 1 FROM public.chart_of_accounts WHERE id IN (SELECT (x->>'account_id')::uuid FROM jsonb_array_elements(p_lines)x) FOR SHARE;
 FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   v_debit:=(v_line->>'debit_amount')::numeric;v_credit:=(v_line->>'credit_amount')::numeric;
   IF v_debit IS NULL OR v_credit IS NULL OR v_debit<0 OR v_credit<0 OR (v_debit>0 AND v_credit>0) OR (v_debit=0 AND v_credit=0)
     OR v_debit::text IN ('NaN','Infinity','-Infinity') OR v_credit::text IN ('NaN','Infinity','-Infinity') OR v_debit<>round(v_debit,2) OR v_credit<>round(v_credit,2)
     OR (v_line->>'entity_id')::uuid IS DISTINCT FROM v_entity THEN RAISE EXCEPTION 'Invalid journal amounts or entity'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE id=(v_line->>'account_id')::uuid AND entity_id=v_entity AND is_active) THEN RAISE EXCEPTION 'Journal account entity mismatch'; END IF;
   IF v_line->>'tenant_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=(v_line->>'tenant_id')::uuid AND entity_id=v_entity) THEN RAISE EXCEPTION 'Journal tenant entity mismatch'; END IF;
   IF v_line->>'property_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=(v_line->>'property_id')::uuid AND entity_id=v_entity) THEN RAISE EXCEPTION 'Journal property entity mismatch'; END IF;
   IF v_line->>'supplier_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=(v_line->>'supplier_id')::uuid AND entity_id=v_entity) THEN RAISE EXCEPTION 'Journal supplier entity mismatch'; END IF;
   IF v_line->>'broker_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.brokers WHERE id=(v_line->>'broker_id')::uuid AND entity_id=v_entity) THEN RAISE EXCEPTION 'Journal broker entity mismatch'; END IF;
   IF v_line->>'bank_account_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bank_accounts WHERE id=(v_line->>'bank_account_id')::uuid AND entity_id=v_entity AND is_active) THEN RAISE EXCEPTION 'Journal bank entity mismatch'; END IF;
   IF v_line->>'lease_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leases l JOIN public.properties p ON p.id=l.property_id WHERE l.id=(v_line->>'lease_id')::uuid AND p.entity_id=v_entity AND (v_line->>'tenant_id' IS NULL OR l.tenant_id=(v_line->>'tenant_id')::uuid)) THEN RAISE EXCEPTION 'Journal lease entity mismatch'; END IF;
 END LOOP;
 IF (SELECT sum((x->>'debit_amount')::numeric-(x->>'credit_amount')::numeric) FROM jsonb_array_elements(p_lines)x)<>0 THEN RAISE EXCEPTION 'Journal is not balanced'; END IF;
 -- Canonical projection ignores regenerated UUIDs/timestamps on a retry, while
 -- retaining every financial amount and dimensional authority.
 SELECT jsonb_agg(jsonb_build_array(x->>'account_id',(x->>'debit_amount')::numeric,(x->>'credit_amount')::numeric,COALESCE((x->>'vat_amount')::numeric,0),COALESCE((x->>'vat_rate')::numeric,0),x->>'tenant_id',x->>'property_id',x->>'lease_id',x->>'supplier_id',x->>'broker_id',x->>'bank_account_id',x->>'cost_centre') ORDER BY x->>'account_id',x->>'tenant_id',x->>'property_id',(x->>'debit_amount')::numeric,(x->>'credit_amount')::numeric) INTO v_normal FROM jsonb_array_elements(p_lines)x;
 IF v_prior.id IS NOT NULL THEN
   SELECT jsonb_agg(jsonb_build_array(account_id::text,debit_amount,credit_amount,COALESCE(vat_amount,0),COALESCE(vat_rate,0),tenant_id::text,property_id::text,lease_id::text,supplier_id::text,broker_id::text,bank_account_id::text,cost_centre) ORDER BY account_id::text,tenant_id::text,property_id::text,debit_amount,credit_amount) INTO v_existing FROM public.journal_lines WHERE journal_id=v_prior.id;
   IF v_existing IS DISTINCT FROM v_normal OR NOT v_prior.is_posted THEN RAISE EXCEPTION 'Journal source replay differs from committed lines'; END IF;
   PERFORM public.post_journal_tenant_ledger(v_prior.id);PERFORM public.post_journal_supplier_ledger(v_prior.id);RETURN v_prior.id;
 END IF;

 PERFORM public.assert_financial_posting_period(v_entity,(p_journal->>'period_id')::uuid);
 -- A registered account may not be moved/deactivated during posting.
 PERFORM 1 FROM public.chart_of_accounts WHERE id IN (SELECT (x->>'account_id')::uuid FROM jsonb_array_elements(p_lines)x) FOR SHARE;
 IF auth.uid() IS NOT NULL THEN p_journal:=p_journal||jsonb_build_object('created_by',auth.uid()); END IF;
 v_result:=public.atomic_post_journal_internal(p_journal,p_lines);
 PERFORM public.post_journal_tenant_ledger(v_result);
 PERFORM public.post_journal_supplier_ledger(v_result);
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 VALUES(v_entity,'journal',v_result,'journal_posted','Atomic financial posting',auth.uid(),'posting-engine',jsonb_build_object('source_event',p_journal->>'source_event','source_id',p_journal->>'source_id'));
 RETURN v_result;
END;
$function$;

-- Closing promotes the existing advance period without changing
-- its ID, journals, balances or historical posting references.

CREATE OR REPLACE FUNCTION public.close_financial_period_atomic(
  p_entity_id uuid,
  p_period_name text,
  p_expected_phase text DEFAULT 'open'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path=''
AS $function$
DECLARE
  c public.financial_periods%ROWTYPE;
  n public.financial_periods%ROWTYPE;
  a public.financial_periods%ROWTYPE;
  d date;
  e date;
  following date;
  suffix text;
  next_name text;
BEGIN
  SELECT * INTO c
  FROM public.financial_periods
  WHERE entity_id=p_entity_id
    AND period_type='financial'
    AND period_name=p_period_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'message','Period not found');
  END IF;

  IF c.workflow_phase IS DISTINCT FROM p_expected_phase THEN
    RETURN jsonb_build_object(
      'success',false,
      'message','Phase conflict',
      'concurrencyConflict',true
    );
  END IF;

  IF c.status<>'open' THEN
    RETURN jsonb_build_object(
      'success',false,'message','Period is not open'
    );
  END IF;

  IF c.period_start<>date_trunc('month',c.period_start)::date
     OR c.period_end<>(c.period_start+interval '1 month - 1 day')::date THEN
    RAISE EXCEPTION 'Financial period must be a full calendar month';
  END IF;

  suffix:=CASE WHEN c.period_name ILIKE '% Financial'
    THEN ' Financial' ELSE '' END;

  d:=(c.period_start+interval '1 month')::date;
  e:=(d+interval '1 month - 1 day')::date;
  next_name:=to_char(d,'FMMonth YYYY')||suffix;

  SELECT * INTO n
  FROM public.financial_periods
  WHERE entity_id=p_entity_id
    AND period_type='financial'
    AND period_start=d
  FOR UPDATE;

  IF FOUND AND (n.status<>'advance' OR n.period_end<>e) THEN
    RAISE EXCEPTION 'Next period is not eligible for promotion';
  END IF;

  following:=(d+interval '1 month')::date;

  SELECT * INTO a
  FROM public.financial_periods
  WHERE entity_id=p_entity_id
    AND period_type='financial'
    AND period_start=following
  FOR UPDATE;

  IF FOUND AND (
    a.status<>'advance'
    OR a.period_end<>(following+interval '1 month - 1 day')::date
  ) THEN
    RAISE EXCEPTION 'Following period has conflicting state';
  END IF;

  UPDATE public.financial_periods
  SET status='closed',workflow_phase='closed',closed_at=now()
  WHERE id=c.id;

  IF n.id IS NOT NULL THEN
    UPDATE public.financial_periods
    SET status='open',workflow_phase='open'
    WHERE id=n.id;
  ELSE
    INSERT INTO public.financial_periods(
      entity_id,period_type,period_name,period_start,
      period_end,status,workflow_phase
    )
    VALUES(
      p_entity_id,'financial',next_name,d,e,'open','open'
    );
  END IF;

  IF a.id IS NULL THEN
    INSERT INTO public.financial_periods(
      entity_id,period_type,period_name,period_start,
      period_end,status,workflow_phase
    )
    VALUES(
      p_entity_id,'financial',
      to_char(following,'FMMonth YYYY')||suffix,
      following,
      (following+interval '1 month - 1 day')::date,
      'advance','advance'
    );
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'nextPeriod',next_name,
    'message','Financial period closed; advance period promoted'
  );
END;
$function$;

COMMIT;
