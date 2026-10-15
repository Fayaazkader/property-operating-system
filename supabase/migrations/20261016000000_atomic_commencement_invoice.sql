BEGIN;
-- Keep the existing journal/GL primitive, but make it private to governed
-- application commands. The established public entry point delegates to it.
ALTER FUNCTION public.atomic_post_journal(jsonb,jsonb) RENAME TO atomic_post_journal_internal;
REVOKE ALL ON FUNCTION public.atomic_post_journal_internal(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.atomic_post_journal(p_journal jsonb,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
 IF p_journal->>'source_event'='lease_commencement_invoice' THEN RAISE EXCEPTION 'Use governed invoice issuance'; END IF;
 RETURN public.atomic_post_journal_internal(p_journal,p_lines);
END;
$function$;
REVOKE ALL ON FUNCTION public.atomic_post_journal(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atomic_post_journal(jsonb,jsonb) TO authenticated,service_role;

ALTER TABLE public.invoices ADD COLUMN commencement_payment_term_id uuid REFERENCES public.payment_terms(id);
ALTER TABLE public.invoices ADD COLUMN commencement_lease_id uuid REFERENCES public.leases(id);
CREATE UNIQUE INDEX invoice_commencement_lease_unique ON public.invoices(commencement_lease_id) WHERE commencement_lease_id IS NOT NULL;
ALTER TABLE public.invoice_line_items ADD COLUMN charge_id uuid REFERENCES public.charges(id);
CREATE UNIQUE INDEX invoice_charge_once ON public.invoice_line_items(charge_id) WHERE charge_id IS NOT NULL;
-- Never rewrite an approved source charge, including before its invoice exists.
CREATE FUNCTION public.protect_commencement_charge() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF OLD.source_type='lease_commencement' THEN RAISE EXCEPTION 'Approved commencement charges require a governed reversal'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$function$;
CREATE TRIGGER commencement_charge_immutable BEFORE UPDATE OR DELETE ON public.charges FOR EACH ROW EXECUTE FUNCTION public.protect_commencement_charge();
REVOKE ALL ON FUNCTION public.protect_commencement_charge() FROM PUBLIC,anon,authenticated;

-- Database portion of the canonical SubLedgerEngine. Only AR control movements
-- affect the tenant balance; revenue, liability and VAT lines are not receivables.
CREATE FUNCTION public.post_journal_tenant_ledger(p_journal_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.journals%ROWTYPE;line public.journal_lines%ROWTYPE;v_ar uuid;v_count int;v_balance numeric;
BEGIN
 SELECT * INTO STRICT j FROM public.journals WHERE id=p_journal_id AND is_posted;
 IF NOT EXISTS(SELECT 1 FROM public.journal_lines WHERE journal_id=j.id AND tenant_id IS NOT NULL) THEN RETURN; END IF;
 PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id
   WHERE c.entity_id=j.entity_id AND c.business_role='ar_control' AND c.is_active FOR SHARE OF c,a;
 SELECT count(*),min(a.id::text)::uuid INTO v_count,v_ar FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active AND a.account_type='asset'
 WHERE c.entity_id=j.entity_id AND c.business_role='ar_control' AND c.is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'One entity AR control account required for tenant posting'; END IF;
 FOR line IN SELECT * FROM public.journal_lines WHERE journal_id=j.id AND tenant_id IS NOT NULL AND account_id=v_ar ORDER BY tenant_id,id LOOP
   IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=line.tenant_id AND entity_id=j.entity_id) THEN RAISE EXCEPTION 'Tenant ledger entity mismatch'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(j.entity_id::text||':tenant:'||line.tenant_id::text,0));
   IF EXISTS(SELECT 1 FROM public.sub_ledger_entries WHERE journal_line_id=line.id AND ledger_type='tenant') THEN CONTINUE; END IF;
   SELECT COALESCE(sum(debit_amount-credit_amount),0) INTO v_balance FROM public.sub_ledger_entries WHERE entity_id=j.entity_id AND tenant_id=line.tenant_id AND ledger_type='tenant';
   INSERT INTO public.sub_ledger_entries(entity_id,ledger_type,journal_line_id,account_id,reference_type,reference_id,description,debit_amount,credit_amount,running_balance,tenant_id,property_id,lease_id)
   VALUES(j.entity_id,'tenant',line.id,v_ar,CASE WHEN j.reference IS NOT NULL THEN 'invoice' ELSE j.source_event END,COALESCE(j.reference,j.id::text),line.description,line.debit_amount,line.credit_amount,v_balance+line.debit_amount-line.credit_amount,line.tenant_id,line.property_id,line.lease_id);
 END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.post_journal_tenant_ledger(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.issue_lease_commencement_invoice(p_entity_id uuid,p_lease_id uuid,p_plan_sha256 text,p_payment_term_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
 l public.leases%ROWTYPE; b public.lease_commencement_billings%ROWTYPE; i public.invoices%ROWTYPE;
 s public.financial_periods%ROWTYPE; f public.financial_periods%ROWTYPE; c public.charges%ROWTYPE;
 v_actor uuid:=auth.uid();v_ar uuid;v_vat uuid;v_count int;v_due int;v_journal uuid:=gen_random_uuid();v_invoice uuid:=gen_random_uuid();
 v_total numeric;v_net numeric;v_tax numeric;v_lines jsonb:='[]';v_ar_line uuid:=gen_random_uuid();v_balance numeric;v_statement uuid;
 v_line jsonb;v_approved jsonb;v_role text;
BEGIN
 IF v_actor IS NULL OR NOT COALESCE(public.has_entity_permission(v_actor,p_entity_id,'leases.approve'),false) THEN RAISE EXCEPTION 'Invoice issuance permission denied'; END IF;
 SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=l.property_id AND entity_id=p_entity_id)
   OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=l.tenant_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Invoice entity mismatch'; END IF;
 SELECT * INTO b FROM public.lease_commencement_billings WHERE lease_id=l.id AND entity_id=p_entity_id;
 IF NOT FOUND OR b.plan_sha256 IS DISTINCT FROM p_plan_sha256 THEN RAISE EXCEPTION 'Approved commencement review required'; END IF;
 -- Lease locking serializes approval/issuance/retry. A committed replay survives
 -- subsequent period closure; no new journal or document is issued on replay.
 SELECT * INTO i FROM public.invoices WHERE commencement_lease_id=l.id;
 IF FOUND THEN
   IF i.commencement_payment_term_id IS DISTINCT FROM p_payment_term_id THEN RAISE EXCEPTION 'Invoice already issued with different payment terms'; END IF;
   IF i.entity_id IS DISTINCT FROM p_entity_id OR i.invoice_status NOT IN ('issued','paid') OR
      NOT EXISTS(SELECT 1 FROM public.journals WHERE source_event='lease_commencement_invoice' AND source_id=i.id::text AND entity_id=p_entity_id AND is_posted) THEN RAISE EXCEPTION 'Invoice requires reconciliation'; END IF;
   SELECT id INTO v_statement FROM public.statements_generated WHERE entity_id=p_entity_id AND tenant_id=l.tenant_id AND statement_data->>'invoice_id'=i.id::text;
   IF NOT EXISTS(SELECT 1 FROM public.sub_ledger_entries e JOIN public.journal_lines jl ON jl.id=e.journal_line_id JOIN public.journals j ON j.id=jl.journal_id WHERE e.entity_id=p_entity_id AND e.tenant_id=l.tenant_id AND e.ledger_type='tenant' AND e.reference_id=i.id::text AND e.debit_amount=i.total_amount AND e.credit_amount=0 AND j.source_event='lease_commencement_invoice' AND j.source_id=i.id::text) THEN RAISE EXCEPTION 'Invoice tenant ledger requires reconciliation'; END IF;
   IF v_statement IS NULL THEN RAISE EXCEPTION 'Invoice statement requires reconciliation'; END IF;
   RETURN jsonb_build_object('invoiceId',i.id,'statementId',v_statement,'replayed',true);
 END IF;
 IF lower(l.lease_status)<>'active' THEN RAISE EXCEPTION 'Active lease required'; END IF;
 SELECT count(*) INTO v_count FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='statement' AND l.lease_start_date BETWEEN period_start AND period_end;
 IF v_count<>1 THEN RAISE EXCEPTION 'One commencement statement period required'; END IF;
 SELECT * INTO s FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='statement' AND l.lease_start_date BETWEEN period_start AND period_end FOR UPDATE;
 SELECT count(*) INTO v_count FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND l.lease_start_date BETWEEN period_start AND period_end;
 IF v_count<>1 THEN RAISE EXCEPTION 'One commencement financial period required'; END IF;
 SELECT * INTO f FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND l.lease_start_date BETWEEN period_start AND period_end FOR UPDATE;
 IF s.status<>'open' OR f.status<>'open' OR s.workflow_phase NOT IN ('open','billing_requested','billing_running') THEN RAISE EXCEPTION 'Commencement periods do not permit issuance'; END IF;
 PERFORM 1 FROM public.statement_periods WHERE entity_id=p_entity_id AND period_name=s.period_name FOR SHARE;
 IF EXISTS(SELECT 1 FROM public.statement_periods WHERE entity_id=p_entity_id AND period_name=s.period_name AND status IN ('closed','locked')) THEN RAISE EXCEPTION 'Legacy statement period is closed'; END IF;
 -- Use the existing tenant payment-term catalogue. Zero days is valid. Missing
 -- contractual/configured terms must be resolved explicitly, never guessed.
 SELECT days INTO v_due FROM public.payment_terms WHERE id=p_payment_term_id FOR SHARE;
 IF v_due IS NULL OR v_due NOT BETWEEN 0 AND 3650 THEN RAISE EXCEPTION 'Configure tenant payment terms before invoice issuance'; END IF;
 PERFORM 1 FROM public.accounting_config ac JOIN public.chart_of_accounts a ON a.id=ac.account_id WHERE ac.entity_id=p_entity_id AND ac.business_role IN ('ar_control','vat_output') AND ac.is_active FOR SHARE OF ac,a;
 SELECT count(*),min(a.id::text)::uuid INTO v_count,v_ar FROM public.accounting_config ac JOIN public.chart_of_accounts a ON a.id=ac.account_id AND a.entity_id=ac.entity_id AND a.is_active AND a.account_type='asset'
   WHERE ac.entity_id=p_entity_id AND ac.business_role='ar_control' AND ac.is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'One entity AR control account required'; END IF;
 SELECT count(*),sum(amount_excl_vat),sum(vat_amount),sum(amount_incl_vat) INTO v_count,v_net,v_tax,v_total FROM public.charges
   WHERE lease_id=l.id AND entity_id=p_entity_id AND source_type='lease_commencement' AND source_id=l.id;
 IF v_count<>b.charge_count OR v_count<>cardinality(b.selected_types) OR v_total IS NULL OR v_total<=0 THEN RAISE EXCEPTION 'Approved charge set requires reconciliation'; END IF;
 IF v_tax>0 THEN
   SELECT count(*),min(a.id::text)::uuid INTO v_count,v_vat FROM public.accounting_config ac JOIN public.chart_of_accounts a ON a.id=ac.account_id AND a.entity_id=ac.entity_id AND a.is_active AND a.account_type='liability'
     WHERE ac.entity_id=p_entity_id AND ac.business_role='vat_output' AND ac.is_active;
   IF v_count<>1 THEN RAISE EXCEPTION 'One entity output VAT account required'; END IF;
 END IF;
 INSERT INTO public.invoices(id,invoice_number,lease_id,commencement_lease_id,commencement_payment_term_id,tenant_id,property_id,entity_id,owner_entity_id,managing_entity_id,
   invoice_status,billing_period_start,billing_period_end,invoice_date,due_date,subtotal_amount,vat_amount,total_amount,outstanding_amount,statement_period_locked)
 VALUES(v_invoice,'INV-C-'||l.id::text,l.id,l.id,p_payment_term_id,l.tenant_id,l.property_id,p_entity_id,l.owner_entity_id,l.managing_entity_id,
   'draft',s.period_start,s.period_end,l.lease_start_date,l.lease_start_date+v_due,v_net,v_tax,v_total,v_total,false);
 FOR c IN SELECT * FROM public.charges WHERE lease_id=l.id AND entity_id=p_entity_id AND source_type='lease_commencement' AND source_id=l.id ORDER BY charge_type FOR SHARE LOOP
   SELECT value INTO v_approved FROM jsonb_array_elements(b.plan->'charges') WHERE value->>'charge_type'=c.charge_type AND c.charge_type=ANY(b.selected_types);
   IF v_approved IS NULL OR c.account_id IS DISTINCT FROM (v_approved->>'account_id')::uuid OR c.tenant_id IS DISTINCT FROM l.tenant_id OR c.property_id IS DISTINCT FROM l.property_id
     OR c.amount_excl_vat IS DISTINCT FROM (v_approved->>'amount_excl_vat')::numeric OR c.vat_rate IS DISTINCT FROM (v_approved->>'vat_rate')::numeric
     OR c.vat_amount IS DISTINCT FROM (v_approved->>'vat_amount')::numeric OR c.amount_incl_vat IS DISTINCT FROM (v_approved->>'amount_incl_vat')::numeric
     OR c.amount_excl_vat+c.vat_amount<>c.amount_incl_vat OR c.billing_period IS DISTINCT FROM s.period_name OR c.financial_period IS DISTINCT FROM f.period_name
     OR c.status IS DISTINCT FROM 'posted' OR NOT c.is_active THEN RAISE EXCEPTION 'Approved charge integrity mismatch'; END IF;
   PERFORM 1 FROM public.chart_of_accounts WHERE id=c.account_id AND entity_id=p_entity_id AND is_active AND account_type=CASE WHEN c.charge_type='deposit' THEN 'liability' ELSE 'income' END FOR SHARE;
   IF NOT FOUND OR (c.charge_type='deposit' AND (c.vat_rate<>0 OR c.vat_amount<>0)) THEN RAISE EXCEPTION 'Charge accounting classification invalid'; END IF;
   INSERT INTO public.invoice_line_items(invoice_id,lease_id,charge_id,line_item_type,description,quantity,unit_rate,amount,vat_applicable,vat_amount,total_amount,billing_category)
     VALUES(v_invoice,l.id,c.id,c.charge_type,c.description,1,c.amount_excl_vat,c.amount_excl_vat,c.vat_amount>0,c.vat_amount,c.amount_incl_vat,c.charge_type);
   v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'account_id',c.account_id,'description',c.description,'debit_amount',0,'credit_amount',c.amount_excl_vat,
     'entity_id',p_entity_id,'property_id',l.property_id,'lease_id',l.id,'vat_amount',0,'vat_rate',c.vat_rate));
 END LOOP;
 v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_ar_line,'account_id',v_ar,'description','Commencement tenant receivable','debit_amount',v_total,'credit_amount',0,
   'entity_id',p_entity_id,'property_id',l.property_id,'lease_id',l.id,'tenant_id',l.tenant_id,'vat_amount',0,'vat_rate',0));
 IF v_tax>0 THEN v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'account_id',v_vat,'description','Output VAT','debit_amount',0,'credit_amount',v_tax,
   'entity_id',p_entity_id,'property_id',l.property_id,'lease_id',l.id,'vat_amount',v_tax,'vat_rate',0)); END IF;
 IF (SELECT sum((x->>'debit_amount')::numeric-(x->>'credit_amount')::numeric) FROM jsonb_array_elements(v_lines)x)<>0 THEN RAISE EXCEPTION 'Invoice journal does not balance'; END IF;
 -- Existing canonical journal primitive inserts journal, journal lines and GL.
 v_journal:=public.atomic_post_journal_internal(jsonb_build_object('id',v_journal,'entity_id',p_entity_id,'journal_number','JNL-C-'||v_invoice::text,
   'journal_type','sales_invoice','description','Approved lease commencement invoice','period_id',f.id,'source_event','lease_commencement_invoice','source_id',v_invoice::text,
   'reference',v_invoice::text,'is_posted',true,'created_by',v_actor,'explanation',jsonb_build_object('plan_sha256',p_plan_sha256,'deposit_funds_received',false,'vat_amount',v_tax)::text),v_lines);
 -- Serialize this tenant's balance alongside every issuance using this command.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_entity_id::text||':tenant:'||l.tenant_id::text,0));
 SELECT COALESCE(sum(debit_amount-credit_amount),0) INTO v_balance FROM public.sub_ledger_entries WHERE entity_id=p_entity_id AND ledger_type='tenant' AND tenant_id=l.tenant_id;
 PERFORM public.post_journal_tenant_ledger(v_journal);
 UPDATE public.invoices SET invoice_status='issued',statement_period_locked=true,updated_at=now() WHERE id=v_invoice;
 INSERT INTO public.statements_generated(entity_id,tenant_id,statement_data) VALUES(p_entity_id,l.tenant_id,jsonb_build_object('invoice_id',v_invoice,'invoice_ref','INV-C-'||l.id::text,
   'period_id',s.id,'statement_date',l.lease_start_date,'charges',(SELECT jsonb_agg(x) FROM jsonb_array_elements(b.plan->'charges')x WHERE x->>'charge_type'=ANY(b.selected_types)),'opening_balance',v_balance,'closing_balance',v_balance+v_total,'invoice_total',v_total,'status','issued')) RETURNING id INTO v_statement;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 VALUES(p_entity_id,'invoice',v_invoice,'invoice_issued','Commencement invoice and tenant receivable posted',v_actor,'revenue',jsonb_build_object('journal_id',v_journal,'plan_sha256',p_plan_sha256,'deposit_funds_received',false));
 UPDATE public.workflow_states w SET status='completed',updated_at=now(),steps=(SELECT jsonb_agg(CASE WHEN step->>'label'='Revenue Active' THEN step||jsonb_build_object('status','completed','completed_at',now(),'invoice_id',v_invoice) ELSE step END ORDER BY ordinal) FROM jsonb_array_elements(w.steps) WITH ORDINALITY s(step,ordinal)) WHERE entity_id=p_entity_id AND reference_type='lease' AND reference_id=l.id::text AND workflow_type='lease_activation';
 RETURN jsonb_build_object('invoiceId',v_invoice,'statementId',v_statement,'journalId',v_journal,'replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.issue_lease_commencement_invoice(uuid,uuid,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.issue_lease_commencement_invoice(uuid,uuid,text,uuid) TO authenticated;
CREATE FUNCTION public.get_lease_commencement_invoice_terms(p_entity_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_selected uuid;v_options jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'leases.approve'),false) THEN RAISE EXCEPTION 'Invoice review permission denied'; END IF;
 SELECT COALESCE(inv.commencement_payment_term_id,t.payment_term_id) INTO v_selected FROM public.leases l JOIN public.properties p ON p.id=l.property_id JOIN public.tenants t ON t.id=l.tenant_id LEFT JOIN public.invoices inv ON inv.commencement_lease_id=l.id AND inv.entity_id=p_entity_id
 WHERE l.id=p_lease_id AND p.entity_id=p_entity_id AND t.entity_id=p_entity_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice review entity mismatch'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',term_name,'days',days) ORDER BY days,term_name),'[]') INTO v_options FROM public.payment_terms WHERE days BETWEEN 0 AND 3650;
 RETURN jsonb_build_object('selectedId',v_selected,'options',v_options);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_lease_commencement_invoice_terms(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_lease_commencement_invoice_terms(uuid,uuid) TO authenticated;
COMMIT;
