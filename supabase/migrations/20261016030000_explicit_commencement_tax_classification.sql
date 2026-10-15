BEGIN;
ALTER TABLE public.leases ADD COLUMN parking_vat_treatment text CHECK(parking_vat_treatment IN ('exclusive','inclusive','not_applicable')),ADD COLUMN parking_tax_code text;
ALTER TABLE public.billing_policies ADD COLUMN lease_fee_vat_treatment text CHECK(lease_fee_vat_treatment IN ('exclusive','inclusive','not_applicable')),ADD COLUMN lease_fee_tax_code text;
INSERT INTO public.permission_catalogue(key,category,name,description) VALUES('finance.billing_policy.manage','finance','Manage billing policies','Configure explicit fees and tax classifications within an authorized entity') ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.create_lease_activation_records(p_entity_id uuid,p_terms jsonb,p_execution_id uuid DEFAULT NULL,p_execution_version integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_property public.properties%ROWTYPE; v_unit public.units%ROWTYPE;
  v_tenant uuid; v_lease uuid; v_ref text; v_code text;
  v_start date := (p_terms->>'commencementDate')::date;
  v_end date := (p_terms->>'expiryDate')::date;
  v_rent numeric := (p_terms->>'monthlyRental')::numeric;
  v_deposit numeric := (p_terms->>'depositAmount')::numeric;
  v_parking integer := COALESCE((p_terms->>'parkingBays')::integer,0);
  v_parking_rate numeric := (p_terms->>'parkingRate')::numeric;
  v_vat text := p_terms->>'rentalVatTreatment';
  v_parking_vat text:=p_terms->>'parkingVatTreatment';v_parking_taxcode text:=p_terms->>'parkingTaxCode';
  v_type text; v_amount numeric; v_account uuid; v_gl text; v_rate numeric;
  v_taxcode text; v_role text; v_count integer; v_net numeric; v_rules integer:=0;
BEGIN
  IF NULLIF(btrim(p_terms->>'prospectName'),'') IS NULL OR v_start IS NULL OR v_end IS NULL OR v_end<v_start OR
     v_rent IS NULL OR v_rent<=0 OR v_rent<>round(v_rent,2) OR v_rent::text IN ('NaN','Infinity','-Infinity') OR
     v_deposit IS NULL OR v_deposit<0 OR v_deposit<>round(v_deposit,2) OR v_deposit::text IN ('NaN','Infinity','-Infinity') OR
     v_vat IS NULL OR v_vat NOT IN ('exclusive','inclusive','not_applicable') OR
     v_parking<0 OR (v_parking>0 AND (v_parking_rate IS NULL OR v_parking_rate<0 OR v_parking_rate::text IN ('NaN','Infinity','-Infinity'))) OR
     (p_terms->>'escalationPercent') IS NULL OR (p_terms->>'escalationPercent')::numeric NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Complete valid contractual activation terms required (including explicit parking price)';
  END IF;
  IF v_parking*COALESCE(v_parking_rate,0)>0 AND (v_parking_vat IS NULL OR v_parking_vat NOT IN ('exclusive','inclusive','not_applicable') OR NULLIF(v_parking_taxcode,'') IS NULL OR (v_parking_vat='not_applicable' AND v_parking_taxcode<>'NO_VAT')) THEN RAISE EXCEPTION 'Explicit signed parking VAT treatment and tax code required'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=(p_terms->>'propertyId')::uuid AND entity_id=p_entity_id;
  IF NOT FOUND OR lower(COALESCE(v_property.property_status,''))<>'active' THEN RAISE EXCEPTION 'Activation property entity mismatch or inactive'; END IF;
  SELECT * INTO v_unit FROM public.units WHERE id=(p_terms->>'unitId')::uuid AND property_id=v_property.id FOR UPDATE;
  IF NOT FOUND OR v_unit.operational_status IS DISTINCT FROM 'Active' THEN RAISE EXCEPTION 'Activation unit unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.leases l WHERE l.unit_id=v_unit.id AND lower(COALESCE(l.lease_status,'')) IN ('active','executed')
    AND daterange(l.lease_start_date,l.lease_end_date,'[]') && daterange(v_start,v_end,'[]')) THEN
    RAISE EXCEPTION 'Unit already has an overlapping operational lease';
  END IF;
  -- Validate mappings before creating any tenant. Each active role/tax must be
  -- unambiguous, entity-scoped and correctly classified; zero tax stays zero.
  FOR v_type,v_amount IN SELECT 'rent',v_rent UNION ALL SELECT 'deposit',v_deposit UNION ALL SELECT 'parking',v_parking*COALESCE(v_parking_rate,0) ORDER BY 1 LOOP
    IF v_amount<=0 THEN CONTINUE; END IF;
    v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' ELSE 'parking_income' END;
    v_taxcode:=CASE v_type WHEN 'deposit' THEN 'NO_VAT' WHEN 'rent' THEN CASE WHEN v_vat='not_applicable' THEN 'NO_VAT' ELSE 'VAT_STANDARD' END ELSE v_parking_taxcode END;
    PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id
      WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true FOR SHARE OF c,a;
    PERFORM 1 FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=v_taxcode AND is_active=true FOR SHARE;
    SELECT count(*),min(c.account_id::text)::uuid,min(a.gl_code) INTO v_count,v_account,v_gl
      FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active=true
      WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true
        AND a.account_type=CASE WHEN v_type='deposit' THEN 'liability' ELSE 'income' END;
    IF v_count<>1 THEN RAISE EXCEPTION 'Required entity account mapping missing or ambiguous: %',v_role; END IF;
    SELECT count(*),min(t.tax_rate) INTO v_count,v_rate FROM public.tax_config t
      WHERE t.entity_id=p_entity_id AND t.tax_code=v_taxcode AND t.is_active=true;
    IF v_count<>1 OR v_rate IS NULL OR v_rate NOT BETWEEN 0 AND 100 OR (v_taxcode='NO_VAT' AND v_rate<>0) THEN
      RAISE EXCEPTION 'Required entity tax configuration missing or invalid: %',v_taxcode;
    END IF;
  END LOOP;
  -- UUID-derived tenant code avoids the old name-prefix collisions. Lease
  -- numbering continues to use the established property-specific allocator.
  v_tenant:=gen_random_uuid(); v_code:='TEN-'||replace(v_tenant::text,'-','');
  INSERT INTO public.tenants(id,entity_id,tenant_name,company_registration,vat_number,email,phone,tenant_type,status,kyc_status,code)
    VALUES(v_tenant,p_entity_id,btrim(p_terms->>'prospectName'),p_terms->>'companyRegistration',p_terms->>'vatNumber',p_terms->>'contactEmail',p_terms->>'contactPhone','Company','Active','Pending',v_code);
  IF NULLIF(p_terms->>'contactEmail','') IS NOT NULL OR NULLIF(p_terms->>'contactPhone','') IS NOT NULL THEN
    INSERT INTO public.tenant_contacts(tenant_id,full_name,email,mobile,is_primary)
      VALUES(v_tenant,COALESCE(NULLIF(p_terms->>'contactPerson',''),p_terms->>'prospectName'),p_terms->>'contactEmail',p_terms->>'contactPhone',true);
  END IF;
  v_ref:=public.generate_lease_number(COALESCE(NULLIF(v_property.property_code,''),'PROP'));
  INSERT INTO public.leases(client_id,tenant_id,property_id,unit_id,owner_entity_id,managing_entity_id,lease_id,tenant_name,company_registration,vat_number,
    lease_status,monthly_rental,lease_start_date,lease_end_date,commencement_date,expiry_date,escalation_percent,deposit_amount,parking_bays,parking_rate,
    lease_type,rental_vat_treatment,parking_vat_treatment,parking_tax_code,gla_sqm,rental_rate_per_sqm,beneficial_occupation_date,active_execution_id,current_execution_version)
  VALUES(v_tenant::text,v_tenant,v_property.id,v_unit.id,COALESCE(v_property.owner_entity_id,p_entity_id),COALESCE(v_property.managing_entity_id,p_entity_id),v_ref,p_terms->>'prospectName',p_terms->>'companyRegistration',p_terms->>'vatNumber',
    'Active',v_rent,v_start,v_end,v_start,v_end,(p_terms->>'escalationPercent')::numeric,v_deposit,v_parking,COALESCE(v_parking_rate,0),
    'commercial',v_vat,v_parking_vat,v_parking_taxcode,(p_terms->>'leasedAreaSqm')::numeric,(p_terms->>'rentalRatePerSqm')::numeric,(p_terms->>'beneficialOccupationDate')::date,p_execution_id,p_execution_version)
  RETURNING id INTO v_lease;
  FOR v_type,v_amount IN SELECT 'rent',v_rent UNION ALL SELECT 'deposit',v_deposit UNION ALL SELECT 'parking',v_parking*COALESCE(v_parking_rate,0) ORDER BY 1 LOOP
    IF v_amount<=0 THEN CONTINUE; END IF;
    v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' ELSE 'parking_income' END;
    v_taxcode:=CASE v_type WHEN 'deposit' THEN 'NO_VAT' WHEN 'rent' THEN CASE WHEN v_vat='not_applicable' THEN 'NO_VAT' ELSE 'VAT_STANDARD' END ELSE v_parking_taxcode END;
    SELECT c.account_id,a.gl_code INTO STRICT v_account,v_gl FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id
      WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true;
    SELECT tax_rate INTO STRICT v_rate FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=v_taxcode AND is_active=true;
    v_net:=CASE WHEN (v_type='rent' AND v_vat='inclusive') OR (v_type='parking' AND v_parking_vat='inclusive') THEN round(v_amount/(1+v_rate/100),2) ELSE v_amount END;
    INSERT INTO public.billing_rules(lease_id,rule_type,description,base_amount,vat_rate,gl_code,account_id,recovery_method,frequency,effective_from,effective_to,escalation_percent,escalation_month,status)
      VALUES(v_lease,v_type,CASE v_type WHEN 'rent' THEN 'Monthly Rental' WHEN 'deposit' THEN 'Tenant Deposit' ELSE 'Monthly Parking' END,v_net,v_rate,v_gl,v_account,'fixed',
        CASE WHEN v_type='deposit' THEN 'once' ELSE 'monthly' END,v_start,CASE WHEN v_type='deposit' THEN NULL ELSE v_end END,
        CASE WHEN v_type='rent' THEN (p_terms->>'escalationPercent')::numeric ELSE NULL END,EXTRACT(MONTH FROM v_start),'active');
    v_rules:=v_rules+1;
  END LOOP;
  UPDATE public.units SET occupancy_status=CASE WHEN current_date BETWEEN v_start AND v_end THEN 'Occupied' ELSE CASE WHEN occupancy_status='Occupied' THEN 'Occupied' ELSE 'Reserved' END END,
    current_lease_id=CASE WHEN current_date BETWEEN v_start AND v_end THEN v_lease ELSE current_lease_id END,
    current_tenant_name=CASE WHEN current_date BETWEEN v_start AND v_end THEN p_terms->>'prospectName' ELSE current_tenant_name END,updated_at=now() WHERE id=v_unit.id;
  INSERT INTO public.workflow_states(entity_id,workflow_type,reference_type,reference_id,status,steps)
    VALUES(p_entity_id,'lease_activation','lease',v_lease::text,'awaiting_approval',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'label','Tenant Created','status','completed'),
      jsonb_build_object('id',gen_random_uuid(),'label','Lease Created','status','completed'),
      jsonb_build_object('id',gen_random_uuid(),'label','Rules Extracted','status','completed'),
      jsonb_build_object('id',gen_random_uuid(),'label','Initial Billing','status','awaiting_approval'),
      jsonb_build_object('id',gen_random_uuid(),'label','Revenue Active','status','pending')));
  INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
    VALUES(p_entity_id,'lease',v_lease::text,'lease_activated','Tenant, lease and contractual rules created; initial billing awaits approval',auth.uid(),'lease-activation-service',jsonb_build_object('execution_id',p_execution_id,'deposit_funds_received',false));
  RETURN jsonb_build_object('tenant_id',v_tenant,'lease_id',v_lease,'tenant_code',v_code,'lease_ref',v_ref,'rules_created',v_rules,
    'documents_attached',0,'contacts_created',CASE WHEN NULLIF(p_terms->>'contactEmail','') IS NOT NULL OR NULLIF(p_terms->>'contactPhone','') IS NOT NULL THEN 1 ELSE 0 END);
END;
$function$;
CREATE OR REPLACE FUNCTION public.prepare_lease_commencement_billing(p_entity_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
 v_lease public.leases%ROWTYPE;v_property public.properties%ROWTYPE;v_policy public.billing_policies%ROWTYPE;
 v_prior public.lease_commencement_billings%ROWTYPE;
 v_actor uuid:=auth.uid();v_charge jsonb;v_charges jsonb:='[]';v_plan jsonb;v_policy_json jsonb;v_role text;v_taxcode text;
 v_taxmode text;v_type text;v_amount numeric;v_rate numeric;v_net numeric;v_vat numeric;v_account uuid;v_gl text;v_count integer;v_name text;
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
   v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' WHEN 'parking' THEN 'parking_income' ELSE 'fee_income' END;
   v_taxmode:=CASE v_type WHEN 'rent' THEN v_lease.rental_vat_treatment WHEN 'deposit' THEN 'not_applicable' WHEN 'parking' THEN v_lease.parking_vat_treatment ELSE v_policy.lease_fee_vat_treatment END;
   v_taxcode:=CASE v_type WHEN 'deposit' THEN 'NO_VAT' WHEN 'rent' THEN CASE WHEN v_taxmode='not_applicable' THEN 'NO_VAT' ELSE 'VAT_STANDARD' END WHEN 'parking' THEN v_lease.parking_tax_code ELSE v_policy.lease_fee_tax_code END;
   IF v_taxmode IS NULL OR v_taxmode NOT IN ('exclusive','inclusive','not_applicable') OR NULLIF(v_taxcode,'') IS NULL OR (v_taxmode='not_applicable' AND v_taxcode<>'NO_VAT') THEN RAISE EXCEPTION 'Explicit contractual or policy VAT classification required for %',v_type; END IF;
   PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true FOR SHARE OF c,a;
   PERFORM 1 FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=v_taxcode AND is_active=true FOR SHARE;
   SELECT count(*),min(c.account_id::text)::uuid,min(a.gl_code) INTO v_count,v_account,v_gl
     FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active=true
     WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true AND a.account_type=CASE WHEN v_type='deposit' THEN 'liability' ELSE 'income' END;
   IF v_count<>1 THEN RAISE EXCEPTION 'Missing or ambiguous commencement account: %',v_role; END IF;
   SELECT count(*),min(t.tax_rate) INTO v_count,v_rate FROM public.tax_config t WHERE t.entity_id=p_entity_id AND t.tax_code=v_taxcode AND t.is_active=true;
   IF v_count<>1 OR v_rate IS NULL OR v_rate NOT BETWEEN 0 AND 100 OR (v_taxcode='NO_VAT' AND v_rate<>0) THEN RAISE EXCEPTION 'Missing or invalid commencement tax: %',v_taxcode; END IF;
   v_net:=CASE WHEN v_taxmode='inclusive' THEN round(v_amount/(1+v_rate/100),2) ELSE round(v_amount,2) END;
   v_vat:=CASE WHEN v_taxmode='inclusive' THEN v_amount-v_net ELSE round(v_net*v_rate/100,2) END;
   v_name:=CASE v_type WHEN 'rent' THEN 'First Month Rental' WHEN 'deposit' THEN 'Tenant Deposit' WHEN 'parking' THEN 'First Month Parking' ELSE COALESCE(v_policy.lease_fee_description,'Lease fee') END;
   v_charge:=jsonb_build_object('id',v_type,'charge_type',v_type,'description',v_name,'source','Lease Agreement','source_detail','Canonical commencement review',
     'account_id',v_account,'gl_code',v_gl,'tax_code',v_taxcode,'vat_rate',v_rate,'vat_treatment',v_taxmode,
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

CREATE FUNCTION public.guard_billing_policy_configuration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_count int;v_rate numeric;
BEGIN
 IF current_setting('role',true) IN ('anon','authenticated') THEN
   IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),CASE WHEN TG_OP='DELETE' THEN OLD.entity_id ELSE NEW.entity_id END,'finance.billing_policy.manage'),false) THEN RAISE EXCEPTION 'Billing policy permission denied'; END IF;
   IF TG_OP='UPDATE' AND NEW.entity_id IS DISTINCT FROM OLD.entity_id THEN RAISE EXCEPTION 'Billing policy entity is immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.lease_fee_amount IS NOT NULL AND (NEW.lease_fee_amount<0 OR NEW.lease_fee_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid configured lease fee'; END IF;
 IF COALESCE(NEW.lease_fee_amount,0)>0 THEN
   IF NEW.lease_fee_vat_treatment IS NULL OR NULLIF(NEW.lease_fee_tax_code,'') IS NULL OR (NEW.lease_fee_vat_treatment='not_applicable' AND NEW.lease_fee_tax_code<>'NO_VAT') THEN RAISE EXCEPTION 'Explicit lease fee VAT classification required'; END IF;
   PERFORM 1 FROM public.tax_config WHERE entity_id=NEW.entity_id AND tax_code=NEW.lease_fee_tax_code AND is_active FOR SHARE;
   SELECT count(*),min(tax_rate) INTO v_count,v_rate FROM public.tax_config WHERE entity_id=NEW.entity_id AND tax_code=NEW.lease_fee_tax_code AND is_active;
   IF v_count<>1 OR v_rate IS NULL OR v_rate NOT BETWEEN 0 AND 100 OR (NEW.lease_fee_tax_code='NO_VAT' AND v_rate<>0) THEN RAISE EXCEPTION 'One valid entity fee tax mapping required'; END IF;
 END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER billing_policy_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.billing_policies FOR EACH ROW EXECUTE FUNCTION public.guard_billing_policy_configuration();
REVOKE ALL ON FUNCTION public.guard_billing_policy_configuration() FROM PUBLIC,anon,authenticated;
COMMIT;
