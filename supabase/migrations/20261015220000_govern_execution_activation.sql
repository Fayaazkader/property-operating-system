BEGIN;

ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS rental_vat_treatment text
  CHECK(rental_vat_treatment IN ('exclusive','inclusive','not_applicable'));
ALTER TABLE public.billing_rules ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id);
CREATE UNIQUE INDEX IF NOT EXISTS leases_governed_execution_uidx ON public.leases(active_execution_id) WHERE active_execution_id IS NOT NULL;

-- Preserve the established numbering algorithm with an explicit safe search path.
CREATE OR REPLACE FUNCTION public.generate_lease_number(property_code text)
RETURNS text LANGUAGE plpgsql SET search_path='' AS $function$
DECLARE v_next integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('lease_number_'||property_code));
 SELECT COALESCE(max(CAST(substring(lease_id FROM '\d+$') AS integer)),0)+1 INTO v_next
   FROM public.leases WHERE lease_id LIKE property_code||'-%';
 RETURN property_code||'-'||lpad(v_next::text,3,'0');
END;
$function$;

-- Private shared record creation for both established manual activation and the
-- executed-agreement entry point. No financial receipts or invoices are invented.
CREATE FUNCTION public.create_lease_activation_records(p_entity_id uuid,p_terms jsonb,p_execution_id uuid DEFAULT NULL,p_execution_version integer DEFAULT 0)
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
  SELECT * INTO v_property FROM public.properties WHERE id=(p_terms->>'propertyId')::uuid AND entity_id=p_entity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation property entity mismatch'; END IF;
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
    v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' ELSE 'recovery_utilities' END;
    v_taxcode:=CASE WHEN v_type='deposit' OR (v_type='rent' AND v_vat='not_applicable') THEN 'NO_VAT' ELSE 'VAT_STANDARD' END;
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
    lease_type,rental_vat_treatment,gla_sqm,rental_rate_per_sqm,beneficial_occupation_date,active_execution_id,current_execution_version)
  VALUES(v_tenant::text,v_tenant,v_property.id,v_unit.id,COALESCE(v_property.owner_entity_id,p_entity_id),COALESCE(v_property.managing_entity_id,p_entity_id),v_ref,p_terms->>'prospectName',p_terms->>'companyRegistration',p_terms->>'vatNumber',
    'Active',v_rent,v_start,v_end,v_start,v_end,(p_terms->>'escalationPercent')::numeric,v_deposit,v_parking,COALESCE(v_parking_rate,0),
    'commercial',v_vat,(p_terms->>'leasedAreaSqm')::numeric,(p_terms->>'rentalRatePerSqm')::numeric,(p_terms->>'beneficialOccupationDate')::date,p_execution_id,p_execution_version)
  RETURNING id INTO v_lease;
  FOR v_type,v_amount IN SELECT 'rent',v_rent UNION ALL SELECT 'deposit',v_deposit UNION ALL SELECT 'parking',v_parking*COALESCE(v_parking_rate,0) ORDER BY 1 LOOP
    IF v_amount<=0 THEN CONTINUE; END IF;
    v_role:=CASE v_type WHEN 'rent' THEN 'rental_income_commercial' WHEN 'deposit' THEN 'deposit_liability' ELSE 'recovery_utilities' END;
    v_taxcode:=CASE WHEN v_type='deposit' OR (v_type='rent' AND v_vat='not_applicable') THEN 'NO_VAT' ELSE 'VAT_STANDARD' END;
    SELECT c.account_id,a.gl_code INTO STRICT v_account,v_gl FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id
      WHERE c.entity_id=p_entity_id AND c.business_role=v_role AND c.is_active=true;
    SELECT tax_rate INTO STRICT v_rate FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=v_taxcode AND is_active=true;
    v_net:=CASE WHEN v_type='rent' AND v_vat='inclusive' THEN round(v_amount/(1+v_rate/100),2) ELSE v_amount END;
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
REVOKE ALL ON FUNCTION public.create_lease_activation_records(uuid,jsonb,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.activate_lease(
 p_entity_id uuid,p_tenant_name text,p_property_id uuid,p_unit_id uuid,p_monthly_rental numeric,p_lease_start_date date,p_lease_end_date date,
 p_company_registration text DEFAULT NULL,p_vat_number text DEFAULT NULL,p_email text DEFAULT NULL,p_phone text DEFAULT NULL,
 p_escalation_percent numeric DEFAULT 8,p_deposit_amount numeric DEFAULT NULL,p_parking_bays integer DEFAULT 0,p_parking_rate numeric DEFAULT 850,
 p_document_name text DEFAULT NULL,p_document_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_result jsonb;v_document uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'leases.approve'),false) THEN RAISE EXCEPTION 'Lease activation permission denied'; END IF;
 -- Preserve the established manual-input defaults, but do not certify KYC or
 -- pretend a caller-supplied URL is an executed governed agreement.
 v_result:=public.create_lease_activation_records(p_entity_id,jsonb_build_object(
   'prospectName',p_tenant_name,'propertyId',p_property_id,'unitId',p_unit_id,'monthlyRental',p_monthly_rental,
   'commencementDate',p_lease_start_date,'expiryDate',p_lease_end_date,'companyRegistration',p_company_registration,
   'vatNumber',p_vat_number,'contactEmail',p_email,'contactPhone',p_phone,'escalationPercent',p_escalation_percent,
   'depositAmount',COALESCE(p_deposit_amount,p_monthly_rental),'parkingBays',p_parking_bays,'parkingRate',p_parking_rate,'rentalVatTreatment','exclusive'));
 IF p_document_name IS NOT NULL THEN
   SELECT id INTO v_document FROM public.documents WHERE entity_id=p_entity_id AND (storage_key=p_document_url OR id::text=p_document_url);
   IF v_document IS NULL THEN RAISE EXCEPTION 'Register the activation document before attaching it'; END IF;
   INSERT INTO public.document_relationships(document_id,related_entity_type,related_entity_id) VALUES(v_document,'lease',(v_result->>'lease_id')::uuid);
   v_result:=v_result||jsonb_build_object('documents_attached',1);
 END IF;
 RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.activate_lease(uuid,text,uuid,uuid,numeric,date,date,text,text,text,text,numeric,numeric,integer,numeric,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.activate_lease(uuid,text,uuid,uuid,numeric,date,date,text,text,text,text,numeric,numeric,integer,numeric,text,text) TO authenticated;

CREATE FUNCTION public.activate_executed_lease(p_entity_id uuid,p_execution_id uuid,p_document_version_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
 v_execution public.executions%ROWTYPE; v_version public.execution_document_versions%ROWTYPE;
 v_opportunity public.leasing_opportunities%ROWTYPE; v_terms jsonb; v_result jsonb; v_signed public.execution_final_artifacts%ROWTYPE;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL OR
   (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) OR
   NOT COALESCE(public.has_entity_permission(p_actor_id,p_entity_id,'leasing.activation.execute'),false) THEN RAISE EXCEPTION 'Execution activation permission denied'; END IF;
 -- Match commercial command lock ordering: opportunity, then execution.
 SELECT o.* INTO v_opportunity FROM public.leasing_opportunities o JOIN public.executions e ON e.source_id=o.id
   WHERE e.id=p_execution_id AND e.source_type='leasing_opportunity' AND o.entity_id=p_entity_id FOR UPDATE OF o;
 IF NOT FOUND THEN RAISE EXCEPTION 'Execution activation entity mismatch'; END IF;
 SELECT * INTO v_execution FROM public.executions WHERE id=p_execution_id FOR UPDATE;
 SELECT * INTO v_version FROM public.execution_document_versions WHERE id=p_document_version_id AND execution_id=p_execution_id AND entity_id=p_entity_id AND version=v_execution.version AND status='active';
 IF NOT FOUND OR v_execution.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Active executed document version required'; END IF;
 IF v_execution.status='activated' THEN
   SELECT jsonb_build_object('tenant_id',l.tenant_id,'lease_id',l.id,'tenant_code',t.code,'lease_ref',l.lease_id,'rules_created',(SELECT count(*) FROM public.billing_rules WHERE lease_id=l.id),'documents_attached',1,'contacts_created',0)
     INTO v_result FROM public.leases l JOIN public.tenants t ON t.id=l.tenant_id
     WHERE l.id=v_opportunity.activated_lease_id AND l.tenant_id=v_opportunity.activated_tenant_id AND l.active_execution_id=p_execution_id;
   IF v_result IS NULL THEN RAISE EXCEPTION 'Activated execution requires reconciliation'; END IF;
   RETURN v_result;
 END IF;
 IF v_execution.status IS DISTINCT FROM 'executed' OR v_execution.is_locked IS DISTINCT FROM true OR v_opportunity.activated_lease_id IS NOT NULL THEN
   RAISE EXCEPTION 'Execution not eligible for activation'; END IF;
 PERFORM public.assert_execution_finalisation_context(p_execution_id,p_document_version_id);
 SELECT * INTO v_signed FROM public.execution_final_artifacts WHERE execution_id=p_execution_id AND document_version_id=p_document_version_id AND artifact_type='signed_pdf' AND status='committed' AND content_sha256=v_execution.sha_hash;
 IF NOT FOUND OR v_signed.storage_path IS DISTINCT FROM v_execution.document_package_url THEN RAISE EXCEPTION 'Committed executed artifact mismatch'; END IF;
 SELECT cv.snapshot INTO v_terms FROM public.lease_generated_document_provenance gp
   JOIN public.leasing_opportunity_versions cv ON cv.id=gp.commercial_version_id AND cv.opportunity_id=v_opportunity.id AND cv.entity_id=p_entity_id
   WHERE gp.id=v_version.generated_lease_provenance_id AND gp.entity_id=p_entity_id
     AND gp.document_id=v_version.document_id AND gp.generated_checksum=v_version.document_checksum
     AND gp.commercial_version_id=v_opportunity.approved_terms_version_id
     AND gp.commercial_version_id::text=v_execution.snapshot->>'commercial_version_id'
     AND gp.commercial_version_id::text=v_version.snapshot->>'commercial_version_id';
 IF v_terms IS NULL OR v_terms->>'opportunityId' IS DISTINCT FROM v_opportunity.id::text THEN RAISE EXCEPTION 'Executed commercial authority mismatch'; END IF;
 v_result:=public.create_lease_activation_records(p_entity_id,v_terms,p_execution_id,v_execution.version);
 INSERT INTO public.documents(entity_id,file_name,mime_type,file_size_bytes,storage_bucket,storage_key,checksum,document_type,status,requires_review,uploaded_by)
   VALUES(p_entity_id,'Executed lease '||(v_result->>'lease_ref')||'.pdf','application/pdf',v_signed.content_length,'execution-documents',v_signed.storage_path,v_signed.content_sha256,'signed_lease','stored',false,p_actor_id);
 INSERT INTO public.document_relationships(document_id,related_entity_type,related_entity_id)
   SELECT id,'lease',(v_result->>'lease_id')::uuid FROM public.documents WHERE entity_id=p_entity_id AND storage_key=v_signed.storage_path AND document_type='signed_lease';
 UPDATE public.leasing_opportunities SET status='activated',activated_lease_id=(v_result->>'lease_id')::uuid,activated_tenant_id=(v_result->>'tenant_id')::uuid,updated_at=now() WHERE id=v_opportunity.id;
 UPDATE public.executions SET status='activated',activated_at=now(),updated_at=now() WHERE id=p_execution_id;
 INSERT INTO public.execution_events(execution_id,event_type,event_data,created_by)
   VALUES(p_execution_id,'lease_activated',v_result||jsonb_build_object('document_version_id',p_document_version_id,'commercial_version_id',v_opportunity.approved_terms_version_id,
     'signed_pdf_sha256',v_signed.content_sha256,'billing_status','awaiting_approval','deposit_funds_received',false),p_actor_id);
 RETURN v_result||jsonb_build_object('documents_attached',1,'billing_status','awaiting_approval');
END;
$function$;
REVOKE ALL ON FUNCTION public.activate_executed_lease(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_executed_lease(uuid,uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.protect_executed_lease_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF OLD.active_execution_id IS NOT NULL AND (
   to_jsonb(OLD)-ARRAY['lease_status','updated_at','renewal_stage','days_to_expiry','vacancy_risk','assigned_leasing_manager']
 ) IS DISTINCT FROM (
   to_jsonb(NEW)-ARRAY['lease_status','updated_at','renewal_stage','days_to_expiry','vacancy_risk','assigned_leasing_manager']
 ) THEN RAISE EXCEPTION 'Executed lease contractual terms require governed amendment'; END IF;
 RETURN NEW;
END;
$function$;
CREATE TRIGGER executed_lease_terms_guard BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.protect_executed_lease_terms();
REVOKE ALL ON FUNCTION public.protect_executed_lease_terms() FROM PUBLIC,anon,authenticated;
COMMIT;
