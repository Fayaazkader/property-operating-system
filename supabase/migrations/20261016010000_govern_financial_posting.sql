BEGIN;
INSERT INTO public.permission_catalogue(key,category,name,description)
VALUES('finance.journal.post','finance','Post financial journals','Post balanced journals within an explicitly authorized entity') ON CONFLICT(key) DO NOTHING;
-- No automatic role grants: this is a financial mutation capability.
REVOKE INSERT,UPDATE,DELETE ON public.journals,public.journal_lines,public.general_ledger FROM anon,authenticated;
ALTER TABLE public.sub_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_ledger_command_insert ON public.sub_ledger_entries AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(ledger_type<>'tenant');
CREATE POLICY tenant_ledger_command_update ON public.sub_ledger_entries AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(ledger_type<>'tenant') WITH CHECK(ledger_type<>'tenant');
CREATE POLICY tenant_ledger_command_delete ON public.sub_ledger_entries AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(ledger_type<>'tenant');
CREATE OR REPLACE FUNCTION public.atomic_post_journal(p_journal jsonb,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_entity uuid:=(p_journal->>'entity_id')::uuid;v_period public.financial_periods%ROWTYPE;
 v_line jsonb;v_result uuid;v_prior public.journals%ROWTYPE;v_debit numeric;v_credit numeric;v_normal jsonb;v_existing jsonb;
BEGIN
 IF p_journal->>'source_event'='lease_commencement_invoice' THEN RAISE EXCEPTION 'Use governed invoice issuance'; END IF;
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
   PERFORM public.post_journal_tenant_ledger(v_prior.id);RETURN v_prior.id;
 END IF;
 SELECT * INTO v_period FROM public.financial_periods WHERE id=(p_journal->>'period_id')::uuid AND entity_id=v_entity AND period_type='financial' FOR UPDATE;
 IF NOT FOUND OR v_period.status<>'open' THEN RAISE EXCEPTION 'Open entity financial period required'; END IF;
 -- A registered account may not be moved/deactivated during posting.
 PERFORM 1 FROM public.chart_of_accounts WHERE id IN (SELECT (x->>'account_id')::uuid FROM jsonb_array_elements(p_lines)x) FOR SHARE;
 IF auth.uid() IS NOT NULL THEN p_journal:=p_journal||jsonb_build_object('created_by',auth.uid()); END IF;
 v_result:=public.atomic_post_journal_internal(p_journal,p_lines);
 PERFORM public.post_journal_tenant_ledger(v_result);
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 VALUES(v_entity,'journal',v_result,'journal_posted','Atomic financial posting',auth.uid(),'posting-engine',jsonb_build_object('source_event',p_journal->>'source_event','source_id',p_journal->>'source_id'));
 RETURN v_result;
END;
$function$;
ALTER FUNCTION public.atomic_post_journal_internal(jsonb,jsonb) SET search_path='';
-- Protect governed invoice evidence from the legacy browser CRUD grants.
CREATE FUNCTION public.invoice_requires_governed_command(p_invoice_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
 SELECT COALESCE((SELECT CASE WHEN NOT COALESCE(public.has_entity_permission(auth.uid(),entity_id,'leases.approve'),false) THEN true ELSE commencement_lease_id IS NOT NULL END FROM public.invoices WHERE id=p_invoice_id),true);
$function$;
REVOKE ALL ON FUNCTION public.invoice_requires_governed_command(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.invoice_requires_governed_command(uuid) TO authenticated;
CREATE FUNCTION public.guard_governed_invoice_writes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
   IF TG_TABLE_NAME='invoices' THEN
     IF NEW.commencement_lease_id IS NOT NULL OR OLD.commencement_lease_id IS NOT NULL THEN RAISE EXCEPTION 'Use governed invoice command'; END IF;
   ELSIF TG_TABLE_NAME='charges' THEN
     IF NEW.source_type='lease_commencement' THEN RAISE EXCEPTION 'Use governed commencement approval'; END IF;
   ELSE
     IF NEW.charge_id IS NOT NULL OR OLD.charge_id IS NOT NULL OR
       (NEW.invoice_id IS NOT NULL AND public.invoice_requires_governed_command(NEW.invoice_id)) OR
       (OLD.invoice_id IS NOT NULL AND public.invoice_requires_governed_command(OLD.invoice_id)) THEN RAISE EXCEPTION 'Governed invoice lines are immutable'; END IF;
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_governed_invoice_writes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER governed_invoice_command_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.guard_governed_invoice_writes();
CREATE TRIGGER governed_invoice_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items FOR EACH ROW EXECUTE FUNCTION public.guard_governed_invoice_writes();
CREATE TRIGGER governed_commencement_approval_guard BEFORE INSERT ON public.charges FOR EACH ROW EXECUTE FUNCTION public.guard_governed_invoice_writes();
COMMIT;
