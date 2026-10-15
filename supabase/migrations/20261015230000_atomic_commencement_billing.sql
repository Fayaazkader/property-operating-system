BEGIN;
-- Preserve the existing charge guard while isolating legacy statement periods.
-- Lock matching rows so a close cannot race an insert in this transaction.
CREATE OR REPLACE FUNCTION public.prevent_charge_into_closed_period() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_period record;
BEGIN
 IF NEW.entity_id IS NULL THEN RAISE EXCEPTION 'Charge entity required'; END IF;
 FOR v_period IN SELECT status FROM public.statement_periods
   WHERE entity_id=NEW.entity_id AND period_name=NEW.billing_period FOR SHARE LOOP
   IF v_period.status IN ('closed','locked') THEN
     RAISE EXCEPTION 'Cannot add charges to a closed statement period';
   END IF;
 END LOOP;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prevent_charge_into_closed_period() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.lease_commencement_billings(
 lease_id uuid PRIMARY KEY REFERENCES public.leases(id),entity_id uuid NOT NULL,
 plan_sha256 text NOT NULL CHECK(plan_sha256~'^[a-f0-9]{64}$'),plan jsonb NOT NULL,selected_types text[] NOT NULL,
 charge_count integer NOT NULL CHECK(charge_count>=0),approved_by uuid NOT NULL,posted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lease_commencement_billings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lease_commencement_billings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.lease_commencement_billings TO service_role;
CREATE FUNCTION public.protect_lease_commencement_billing() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN RAISE EXCEPTION 'Posted commencement billing is immutable'; END;
$function$;
CREATE TRIGGER lease_commencement_billing_immutable BEFORE UPDATE OR DELETE ON public.lease_commencement_billings FOR EACH ROW EXECUTE FUNCTION public.protect_lease_commencement_billing();
REVOKE ALL ON FUNCTION public.protect_lease_commencement_billing() FROM PUBLIC,anon,authenticated;

-- A canonical server-calculated review model. Client amounts/accounts/taxes are
-- never posting authority. Full first month preserves established billing policy;
-- prorating requires a separately approved contractual policy, not a guess here.
CREATE FUNCTION public.prepare_lease_commencement_billing(p_entity_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
 v_lease public.leases%ROWTYPE;v_property public.properties%ROWTYPE;v_policy public.billing_policies%ROWTYPE;
 v_prior public.lease_commencement_billings%ROWTYPE;
 v_actor uuid:=auth.uid();v_charge jsonb;v_charges jsonb:='[]';v_plan jsonb;v_policy_json jsonb;v_role text;v_taxcode text;
 v_type text;v_amount numeric;v_rate numeric;v_net numeric;v_vat numeric;v_account uuid;v_gl text;v_count integer;v_name text;
BEGIN
 IF v_actor IS NULL OR NOT COALESCE(public.has_entity_permission(v_actor,p_entity_id,'leases.approve'),false) THEN RAISE EXCEPTION 'Initial billing permission denied'; END IF;
 SELECT * INTO v_lease FROM public.leases WHERE id=p_lease_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease unavailable'; END IF;
 SELECT * INTO v_property FROM public.properties WHERE id=v_lease.property_id AND entity_id=p_entity_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=v_lease.tenant_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Initial billing entity mismatch'; END IF;
 IF lower(COALESCE(v_lease.lease_status,''))<>'active' OR v_lease.lease_start_date IS NULL OR v_lease.lease_end_date<v_lease.lease_start_date THEN RAISE EXCEPTION 'Active lease dates required'; END IF;
 SELECT * INTO v_prior FROM public.lease_commencement_billings WHERE lease_id=p_lease_id AND entity_id=p_entity_id;
 IF FOUND THEN
   RETURN v_prior.plan||jsonb_build_object('status','posted','charges',(
     SELECT jsonb_agg(c||jsonb_build_object('selected',c->>'charge_type'=ANY(v_prior.selected_types)) ORDER BY ordinal)
     FROM jsonb_array_elements(v_prior.plan->'charges') WITH ORDINALITY AS s(c,ordinal)));
 END IF;
 PERFORM 1 FROM public.billing_policies WHERE entity_id=p_entity_id AND policy_type='commercial' AND is_active=true FOR SHARE;
 SELECT count(*) INTO v_count FROM public.billing_policies WHERE entity_id=p_entity_id AND policy_type='commercial' AND is_active=true;
 IF v_count>1 THEN RAISE EXCEPTION 'Ambiguous initial billing policy'; END IF;
 SELECT * INTO v_policy FROM public.billing_policies WHERE entity_id=p_entity_id AND policy_type='commercial' AND is_active=true;
 IF v_policy.lease_fee_amount<0 THEN RAISE EXCEPTION 'Invalid initial billing policy'; END IF;
 v_policy_json:=jsonb_build_object('lease_fee_amount',COALESCE(v_policy.lease_fee_amount,0),'lease_fee_description',COALESCE(v_policy.lease_fee_description,'Lease fee'),
   'late_payment_fee_pct',COALESCE(v_policy.late_payment_value,0),'late_payment_fee_description',COALESCE(v_policy.late_payment_description,'Late Payment Fee'),
   'deposit_months',COALESCE(v_policy.deposit_months,0),'billing_day',COALESCE(v_policy.billing_day,EXTRACT(DAY FROM v_lease.lease_start_date)::int),
   'auto_approve_below',0,'source',COALESCE(v_policy.policy_name,'Contractual commencement charges; no additional fee policy'));
 FOR v_type,v_amount IN SELECT 'rent',v_lease.monthly_rental UNION ALL SELECT 'deposit',v_lease.deposit_amount UNION ALL
   SELECT 'parking',v_lease.parking_bays*v_lease.parking_rate UNION ALL SELECT 'lease_fee',COALESCE(v_policy.lease_fee_amount,0) LOOP
   IF v_amount IS NULL OR v_amount<0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid contractual commencement amount'; END IF;
   IF v_amount=0 THEN CONTINUE; END IF;
   v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' WHEN 'parking' THEN 'recovery_utilities' ELSE 'fee_income' END;
   v_taxcode:=CASE WHEN v_type IN ('deposit','lease_fee') OR (v_type='rent' AND v_lease.rental_vat_treatment='not_applicable') THEN 'NO_VAT' ELSE 'VAT_STANDARD' END;
   PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true FOR SHARE OF c,a;
   PERFORM 1 FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=v_taxcode AND is_active=true FOR SHARE;
   SELECT count(*),min(c.account_id::text)::uuid,min(a.gl_code) INTO v_count,v_account,v_gl
     FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active=true
     WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true AND a.account_type=CASE WHEN v_type='deposit' THEN 'liability' ELSE 'income' END;
   IF v_count<>1 THEN RAISE EXCEPTION 'Missing or ambiguous commencement account: %',v_role; END IF;
   SELECT count(*),min(t.tax_rate) INTO v_count,v_rate FROM public.tax_config t WHERE t.entity_id=p_entity_id AND t.tax_code=v_taxcode AND t.is_active=true;
   IF v_count<>1 OR v_rate IS NULL OR v_rate NOT BETWEEN 0 AND 100 OR (v_taxcode='NO_VAT' AND v_rate<>0) THEN RAISE EXCEPTION 'Missing or invalid commencement tax: %',v_taxcode; END IF;
   v_net:=CASE WHEN v_type='rent' AND v_lease.rental_vat_treatment='inclusive' THEN round(v_amount/(1+v_rate/100),2) ELSE round(v_amount,2) END;
   v_vat:=CASE WHEN v_type='rent' AND v_lease.rental_vat_treatment='inclusive' THEN v_amount-v_net ELSE round(v_net*v_rate/100,2) END;
   v_name:=CASE v_type WHEN 'rent' THEN 'First Month Rental' WHEN 'deposit' THEN 'Tenant Deposit' WHEN 'parking' THEN 'First Month Parking' ELSE COALESCE(v_policy.lease_fee_description,'Lease fee') END;
   v_charge:=jsonb_build_object('id',v_type,'charge_type',v_type,'description',v_name,'source','Lease Agreement','source_detail','Canonical commencement review',
     'account_id',v_account,'gl_code',v_gl,'tax_code',v_taxcode,'vat_rate',v_rate,'vat_treatment',CASE WHEN v_taxcode='NO_VAT' THEN 'no_vat' ELSE 'standard' END,
     'amount_excl_vat',v_net,'vat_amount',v_vat,'amount_incl_vat',v_net+v_vat,'selected',true);
   v_charges:=v_charges||jsonb_build_array(v_charge);
 END LOOP;
 SELECT tenant_name INTO v_name FROM public.tenants WHERE id=v_lease.tenant_id;
 v_plan:=jsonb_build_object('leaseId',p_lease_id,'entityId',p_entity_id,'tenantName',v_name,'leaseRef',v_lease.lease_id,'propertyName',v_property.property_name,
   'charges',v_charges,'policy',v_policy_json,'commencementDate',v_lease.lease_start_date,'status','calculated',
   'total_excl_vat',(SELECT COALESCE(sum((c->>'amount_excl_vat')::numeric),0) FROM jsonb_array_elements(v_charges)c),
   'total_incl_vat',(SELECT COALESCE(sum((c->>'amount_incl_vat')::numeric),0) FROM jsonb_array_elements(v_charges)c));
 RETURN v_plan||jsonb_build_object('planSha256',encode(sha256(convert_to(v_plan::text,'UTF8')),'hex'));
END;
$function$;
REVOKE ALL ON FUNCTION public.prepare_lease_commencement_billing(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_lease_commencement_billing(uuid,uuid) TO authenticated;

CREATE FUNCTION public.post_lease_commencement_billing(p_entity_id uuid,p_lease_id uuid,p_plan_sha256 text,p_selected_types text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
 v_plan jsonb;v_prior public.lease_commencement_billings%ROWTYPE;v_lease public.leases%ROWTYPE;
 v_statement public.financial_periods%ROWTYPE;v_financial public.financial_periods%ROWTYPE;
 v_selected text[];v_charge jsonb;v_count integer:=0;v_period_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'leases.approve'),false) THEN RAISE EXCEPTION 'Initial billing permission denied'; END IF;
 SELECT * INTO v_lease FROM public.leases WHERE id=p_lease_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=v_lease.property_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Initial billing entity mismatch'; END IF;
 SELECT array_agg(t ORDER BY t) INTO v_selected FROM unnest(p_selected_types)t;
 IF v_selected IS NULL OR cardinality(v_selected)=0 OR cardinality(v_selected)<>(SELECT count(DISTINCT t) FROM unnest(v_selected)t) THEN RAISE EXCEPTION 'Select unique commencement charges'; END IF;
 SELECT * INTO v_prior FROM public.lease_commencement_billings WHERE lease_id=p_lease_id;
 IF FOUND THEN
   IF v_prior.entity_id IS DISTINCT FROM p_entity_id OR v_prior.plan_sha256 IS DISTINCT FROM p_plan_sha256 OR v_prior.selected_types IS DISTINCT FROM v_selected THEN RAISE EXCEPTION 'Initial billing already approved with different authority'; END IF;
   RETURN 0;
 END IF;
 v_plan:=public.prepare_lease_commencement_billing(p_entity_id,p_lease_id);
 IF p_plan_sha256 IS DISTINCT FROM v_plan->>'planSha256' THEN RAISE EXCEPTION 'Commencement review is stale; reload before approval'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_selected)t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_plan->'charges')c WHERE c->>'charge_type'=t)) THEN RAISE EXCEPTION 'Unknown commencement charge selection'; END IF;
 -- Lock period rows against close, and require unambiguous date/entity coverage.
 SELECT count(*) INTO v_period_count FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='statement' AND v_lease.lease_start_date BETWEEN period_start AND period_end;
 IF v_period_count<>1 THEN RAISE EXCEPTION 'One commencement statement period required'; END IF;
 SELECT * INTO v_statement FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='statement' AND v_lease.lease_start_date BETWEEN period_start AND period_end FOR UPDATE;
 SELECT count(*) INTO v_period_count FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND v_lease.lease_start_date BETWEEN period_start AND period_end;
 IF v_period_count<>1 THEN RAISE EXCEPTION 'One commencement financial period required'; END IF;
 SELECT * INTO v_financial FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND v_lease.lease_start_date BETWEEN period_start AND period_end FOR UPDATE;
 IF v_statement.status<>'open' OR v_financial.status<>'open' OR v_statement.workflow_phase NOT IN ('open','billing_requested','billing_running') THEN RAISE EXCEPTION 'Commencement periods do not permit billing'; END IF;
 IF EXISTS(SELECT 1 FROM public.charges WHERE lease_id=p_lease_id AND source_type='lease_commencement') THEN RAISE EXCEPTION 'Legacy commencement charges require reconciliation'; END IF;
 FOR v_charge IN SELECT c FROM jsonb_array_elements(v_plan->'charges')c WHERE c->>'charge_type'=ANY(v_selected) LOOP
   INSERT INTO public.charges(lease_id,tenant_id,property_id,entity_id,owner_entity_id,managing_entity_id,account_id,charge_type,description,amount_excl_vat,vat_rate,vat_amount,amount_incl_vat,
     recurrence_rule,recovery_method,gl_code,is_active,status,billing_period,financial_period,source_type,source_id,approved_by,posted_at)
   VALUES(p_lease_id,v_lease.tenant_id,v_lease.property_id,p_entity_id,v_lease.owner_entity_id,v_lease.managing_entity_id,(v_charge->>'account_id')::uuid,v_charge->>'charge_type',v_charge->>'description',
     (v_charge->>'amount_excl_vat')::numeric,(v_charge->>'vat_rate')::numeric,(v_charge->>'vat_amount')::numeric,(v_charge->>'amount_incl_vat')::numeric,
     jsonb_build_object('frequency','once'),'fixed',v_charge->>'gl_code',true,'posted',v_statement.period_name,v_financial.period_name,'lease_commencement',p_lease_id,auth.uid()::text,now());
   v_count:=v_count+1;
 END LOOP;
 INSERT INTO public.lease_commencement_billings(lease_id,entity_id,plan_sha256,plan,selected_types,charge_count,approved_by)
   VALUES(p_lease_id,p_entity_id,p_plan_sha256,v_plan,v_selected,v_count,auth.uid());
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
   VALUES(p_entity_id,'lease',p_lease_id,'initial_billing_posted','Approved contractual commencement charges',auth.uid(),'initial-billing-service',jsonb_build_object('plan_sha256',p_plan_sha256,'charge_count',v_count,'deposit_funds_received',false));
 UPDATE public.workflow_states w SET status='in_progress',updated_at=now(),steps=(
   SELECT jsonb_agg(CASE WHEN step->>'label'='Initial Billing' THEN step||jsonb_build_object('status','completed','completed_at',now(),'actor_id',auth.uid())
     WHEN step->>'label'='Revenue Active' THEN step||jsonb_build_object('status','in_progress') ELSE step END ORDER BY ordinal)
   FROM jsonb_array_elements(w.steps) WITH ORDINALITY AS s(step,ordinal))
   WHERE w.workflow_type='lease_activation' AND w.reference_type='lease' AND w.reference_id=p_lease_id::text AND w.entity_id=p_entity_id;
 RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.post_lease_commencement_billing(uuid,uuid,text,text[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.post_lease_commencement_billing(uuid,uuid,text,text[]) TO authenticated;
COMMIT;
