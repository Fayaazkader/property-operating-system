BEGIN;
-- Organisation creation is independent of client financial setup.
CREATE OR REPLACE FUNCTION public.provision_client_account(
    p_client_name text,
    p_entity_name text,
    p_entity_code text,
    p_role_type_name text,
    p_full_name text,
    p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_auth_email text;
    v_client_account_id uuid;
    v_role_type_id uuid;
    v_client_user_id uuid;
    v_entity_id uuid;
    v_standard_access_profile_id uuid;
    v_financial_result jsonb;
    v_result jsonb;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lower(btrim(au.email))
    INTO v_auth_email
    FROM auth.users AS au
    WHERE au.id = v_actor_id;

    IF v_auth_email IS NULL
       OR v_auth_email = ''
    THEN
        RAISE EXCEPTION 'Authenticated user identity could not be resolved';
    END IF;

    IF p_client_name IS NULL OR btrim(p_client_name) = '' THEN
        RAISE EXCEPTION 'Client account name is required';
    END IF;

    IF p_entity_name IS NULL OR btrim(p_entity_name) = '' THEN
        RAISE EXCEPTION 'Legal entity name is required';
    END IF;

    IF p_entity_code IS NULL OR btrim(p_entity_code) = '' THEN
        RAISE EXCEPTION 'Legal entity code is required';
    END IF;

    IF p_role_type_name IS NULL OR btrim(p_role_type_name) = '' THEN
        RAISE EXCEPTION 'Organisational role is required';
    END IF;

    IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
        RAISE EXCEPTION 'Full name is required';
    END IF;

    IF p_email IS NULL OR btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;

    IF lower(btrim(p_email)) <> v_auth_email THEN
        RAISE EXCEPTION 'Email must match the authenticated user';
    END IF;

    -- Serialize first-client creation per authenticated actor, including retries
    -- after a committed response was lost. No caller-supplied actor is accepted.
    PERFORM pg_advisory_xact_lock(hashtextextended('client-onboarding:' || v_actor_id::text, 0));
    SELECT result INTO v_result FROM public.client_onboarding_receipts WHERE user_id = v_actor_id;
    IF FOUND THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.client_users cu
            JOIN public.client_accounts ca ON ca.id = cu.client_account_id
            JOIN public.user_entity_access uea ON uea.user_id = cu.user_id
            JOIN public.entities e ON e.id = uea.entity_id AND e.client_account_id = ca.id
            WHERE cu.id = (v_result->>'client_user_id')::uuid
              AND cu.user_id = v_actor_id AND cu.status = 'active' AND cu.is_super_user = true
              AND ca.status = 'active' AND e.id = (v_result->>'entity_id')::uuid
        ) THEN
            RAISE EXCEPTION 'Existing workspace access requires administrator review';
        END IF;
        RETURN v_result;
    END IF;
    -- This command is initial onboarding, not a way to bypass suspended or
    -- existing membership. Additional entities use client administration.
    IF EXISTS (SELECT 1 FROM public.client_users WHERE user_id = v_actor_id)
       OR EXISTS (SELECT 1 FROM public.user_entity_access WHERE user_id = v_actor_id) THEN
        RAISE EXCEPTION 'An existing membership requires administrator review; no new workspace was created';
    END IF;

    -- Preserve platform authority independently. This upsert deliberately
    -- does not overwrite an existing platform_role.
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        platform_role
    )
    VALUES (
        v_actor_id,
        v_auth_email,
        btrim(p_full_name),
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name;

    INSERT INTO public.client_accounts (
        name,
        status
    )
    VALUES (
        btrim(p_client_name),
        'active'
    )
    RETURNING id
    INTO v_client_account_id;

    INSERT INTO public.client_role_types (
        client_account_id,
        name,
        is_active
    )
    VALUES (
        v_client_account_id,
        btrim(p_role_type_name),
        true
    )
    RETURNING id
    INTO v_role_type_id;

    INSERT INTO public.client_users (
        client_account_id,
        user_id,
        role_type_id,
        is_super_user,
        status
    )
    VALUES (
        v_client_account_id,
        v_actor_id,
        v_role_type_id,
        true,
        'active'
    )
    RETURNING id
    INTO v_client_user_id;

    INSERT INTO public.entities (
        entity_code,
        entity_name,
        name,
        client_account_id
    )
    VALUES (
        btrim(p_entity_code),
        btrim(p_entity_name),
        btrim(p_entity_name),
        v_client_account_id
    )
    RETURNING id
    INTO v_entity_id;

    -- Canonical entity scope. Legacy role fields carry no authority.
    INSERT INTO public.user_entity_access (
        user_id,
        entity_id,
        role_id,
        org_role
    )
    VALUES (
        v_actor_id,
        v_entity_id,
        NULL,
        'read_only'
    );

    -- Temporary compatibility projection for remaining legacy readers.
    INSERT INTO public.user_entities (
        user_id,
        entity_id,
        role
    )
    VALUES (
        v_actor_id,
        v_entity_id,
        'viewer'
    )
    ON CONFLICT (user_id, entity_id) DO UPDATE
    SET role = EXCLUDED.role;

    -- Establish the canonical baseline profile and attach it to the first
    -- client member. Super User administration authority remains separate.
    v_standard_access_profile_id :=
        public.sync_standard_access_profile_internal(
            v_client_account_id,
            v_actor_id
        );

    INSERT INTO public.client_user_access_profiles (
        client_account_id,
        client_user_id,
        access_profile_id,
        assigned_by
    )
    VALUES (
        v_client_account_id,
        v_client_user_id,
        v_standard_access_profile_id,
        v_actor_id
    )
    ON CONFLICT (client_user_id, access_profile_id)
    DO NOTHING;

    v_financial_result := jsonb_build_object('status','configuration_required','entity_id',v_entity_id);

    -- Final graph validation. Any failure rolls back the complete
    -- provisioning transaction.
    IF NOT EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        WHERE ca.id = v_client_account_id
          AND ca.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Client account provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_users AS cu
        WHERE cu.id = v_client_user_id
          AND cu.client_account_id = v_client_account_id
          AND cu.user_id = v_actor_id
          AND cu.role_type_id = v_role_type_id
          AND cu.is_super_user = true
          AND cu.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Initial client Super User provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.entities AS e
        WHERE e.id = v_entity_id
          AND e.client_account_id = v_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client legal entity provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = v_actor_id
          AND uea.entity_id = v_entity_id
          AND uea.role_id IS NULL
          AND uea.org_role = 'read_only'
    ) THEN
        RAISE EXCEPTION 'Initial canonical entity scope provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entities AS ue
        WHERE ue.user_id = v_actor_id
          AND ue.entity_id = v_entity_id
          AND ue.role = 'viewer'
    ) THEN
        RAISE EXCEPTION 'Initial compatibility entity scope provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.access_profiles AS ap
        INNER JOIN public.client_user_access_profiles AS cuap
          ON cuap.access_profile_id = ap.id
        WHERE ap.id = v_standard_access_profile_id
          AND ap.client_account_id = v_client_account_id
          AND ap.system_key = 'standard_access'
          AND ap.is_system = true
          AND cuap.client_account_id = v_client_account_id
          AND cuap.client_user_id = v_client_user_id
    ) THEN
        RAISE EXCEPTION 'Initial Standard Access provisioning failed';
    END IF;

    v_result := jsonb_build_object(
        'client_account_id', v_client_account_id,
        'client_user_id', v_client_user_id,
        'role_type_id', v_role_type_id,
        'entity_id', v_entity_id,
        'standard_access_profile_id', v_standard_access_profile_id,
        'user_id', v_actor_id,
        'is_super_user', true,
        'financial_foundation', v_financial_result,
        'status', 'provisioned'
    );
    INSERT INTO public.client_onboarding_receipts(user_id, result) VALUES(v_actor_id, v_result);
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_client_account(
    text,
    text,
    text,
    text,
    text,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_client_account(
    text,
    text,
    text,
    text,
    text,
    text
) TO authenticated;


INSERT INTO public.permission_catalogue(key,category,name,description,scope,assignable_by_client,super_user_inherent,is_active,default_access)
VALUES('finance.configuration.manage','finance','Manage financial configuration','Import and explicitly review entity accounting configuration','client',true,false,true,false) ON CONFLICT(key) DO NOTHING;
CREATE TABLE public.entity_financial_readiness (
 entity_id uuid PRIMARY KEY REFERENCES public.entities(id),
 revision bigint NOT NULL DEFAULT 0,
 reviewed_revision bigint,
 vat_status text CHECK(vat_status IN ('registered','not_registered')),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz
);
ALTER TABLE public.entity_financial_readiness ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entity_financial_readiness FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.can_manage_entity_financial_configuration(p_entity uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.entities e JOIN public.user_entity_access u ON u.entity_id=e.id AND u.user_id=auth.uid()
 WHERE e.id=p_entity AND (public.is_active_client_super_user(auth.uid(),e.client_account_id)
 OR public.has_entity_permission(auth.uid(),e.id,'finance.configuration.manage')));
$$;
REVOKE ALL ON FUNCTION public.can_manage_entity_financial_configuration(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.financial_configuration_state(p_entity uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.entity_financial_readiness%ROWTYPE; problems jsonb:='[]'; roles jsonb:='{}'; r text; expected text; n int; base_ok boolean; e public.entities%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.entities WHERE id=p_entity;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entity unavailable'; END IF;
 SELECT * INTO s FROM public.entity_financial_readiness WHERE entity_id=p_entity;
 IF NOT EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE entity_id=p_entity AND is_active) THEN problems:=problems||'"Add or import your chart of accounts"'::jsonb; END IF;
 IF EXISTS(SELECT gl_code FROM public.chart_of_accounts WHERE entity_id=p_entity GROUP BY gl_code HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM public.chart_of_accounts c LEFT JOIN public.chart_of_accounts p ON p.id=c.parent_account_id WHERE c.entity_id=p_entity AND c.parent_account_id IS NOT NULL AND (p.id IS NULL OR p.entity_id<>p_entity OR p.id=c.id)) THEN problems:=problems||'"Resolve duplicate codes or invalid account hierarchy"'::jsonb; END IF;
 IF EXISTS(WITH RECURSIVE walk AS (
 SELECT id,parent_account_id,ARRAY[id] path,false cycle FROM public.chart_of_accounts WHERE entity_id=p_entity
 UNION ALL SELECT p.id,p.parent_account_id,w.path||p.id,p.id=ANY(w.path) FROM walk w JOIN public.chart_of_accounts p ON p.id=w.parent_account_id WHERE NOT w.cycle
 ) SELECT 1 FROM walk WHERE cycle) THEN problems:=problems||'"Resolve cyclic account hierarchy"'::jsonb; END IF;
 IF e.accounting_mode IS NULL OR e.accounting_mode NOT IN ('cash','accrual') OR e.base_currency IS NULL OR e.base_currency !~ '^[A-Z]{3}$' OR e.financial_year_start IS NULL OR e.financial_year_start NOT BETWEEN 1 AND 12 THEN problems:=problems||'"Complete accounting method, currency and year start"'::jsonb; END IF;
 IF s.vat_status IS NULL THEN problems:=problems||'"Select VAT registration treatment"'::jsonb; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tax_config WHERE entity_id=p_entity AND is_active) OR EXISTS(SELECT 1 FROM public.tax_config WHERE entity_id=p_entity AND is_active AND (tax_rate IS NULL OR tax_rate::text IN ('NaN','Infinity','-Infinity') OR tax_rate<0 OR tax_rate>100 OR (s.vat_status='not_registered' AND (tax_rate<>0 OR is_recoverable IS DISTINCT FROM false)))) OR EXISTS(SELECT tax_code FROM public.tax_config WHERE entity_id=p_entity AND is_active GROUP BY tax_code HAVING count(*)>1) THEN problems:=problems||'"Configure unambiguous valid tax codes consistent with VAT registration"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.accounting_config c LEFT JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active WHERE c.entity_id=p_entity AND c.is_active AND a.id IS NULL) OR EXISTS(SELECT business_role FROM public.accounting_config WHERE entity_id=p_entity AND is_active GROUP BY business_role HAVING count(*)>1) THEN problems:=problems||'"Resolve inactive, foreign or duplicate accounting mappings"'::jsonb; END IF;
 IF EXISTS(SELECT account_id FROM public.accounting_config WHERE entity_id=p_entity AND is_active AND business_role IN ('ar_control','ap_control','deposit_liability','vat_input','vat_output') GROUP BY account_id HAVING count(DISTINCT business_role)>1) THEN problems:=problems||'"Control accounts must have distinct roles"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE entity_id=p_entity AND is_active AND (vat_rate IS NULL OR vat_rate::text IN ('NaN','Infinity','-Infinity') OR vat_rate<0 OR vat_rate>100 OR (s.vat_status='not_registered' AND (vat_rate<>0 OR is_vatable IS DISTINCT FROM false)))) THEN problems:=problems||'"Review account VAT settings against the selected registration treatment"'::jsonb; END IF;
 FOREACH r IN ARRAY ARRAY['ar_control','ap_control','deposit_liability','vat_input','vat_output'] LOOP
  expected:=CASE WHEN r IN ('ar_control','vat_input') THEN 'asset' ELSE 'liability' END;
  SELECT count(*) INTO n FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active AND a.account_type=expected WHERE c.entity_id=p_entity AND c.business_role=r AND c.is_active;
  roles:=roles||jsonb_build_object(r,n=1);
 END LOOP;
 base_ok:=jsonb_array_length(problems)=0;
 RETURN jsonb_build_object('entity_id',p_entity,'revision',coalesce(s.revision,0),'reviewed',s.reviewed_revision IS NOT NULL AND s.reviewed_revision=s.revision,'vat_status',s.vat_status,'accounting_mode',e.accounting_mode,'currency',e.base_currency,'year_start',e.financial_year_start,'issues',problems,'mappings',roles,
 'journal',base_ok,'receivable',base_ok AND (roles->>'ar_control')::boolean AND (s.vat_status='not_registered' OR (roles->>'vat_output')::boolean),
 'payable',base_ok AND (roles->>'ap_control')::boolean AND (s.vat_status='not_registered' OR (roles->>'vat_input')::boolean),
 'deposit',base_ok AND (roles->>'ar_control')::boolean AND (roles->>'deposit_liability')::boolean);
END;$$;
REVOKE ALL ON FUNCTION public.financial_configuration_state(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_entity_financial_readiness(p_entity uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_entity_access WHERE user_id=auth.uid() AND entity_id=p_entity) THEN RAISE EXCEPTION 'Entity access denied'; END IF;
 RETURN public.financial_configuration_state(p_entity)||jsonb_build_object('can_manage',public.can_manage_entity_financial_configuration(p_entity),
 'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.gl_code),'[]') FROM public.chart_of_accounts a WHERE a.entity_id=p_entity),
 'taxes',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.tax_code),'[]') FROM public.tax_config t WHERE t.entity_id=p_entity),
 'posting_templates',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.posting_templates p WHERE p.entity_id=p_entity),
 'posting_template_lines',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.template_id,l.sequence),'[]') FROM public.posting_template_lines l JOIN public.posting_templates p ON p.id=l.template_id WHERE p.entity_id=p_entity),
 'account_mappings',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.business_role),'[]') FROM public.accounting_config c WHERE c.entity_id=p_entity));
END;$$;
REVOKE ALL ON FUNCTION public.get_entity_financial_readiness(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_entity_financial_readiness(uuid) TO authenticated;

CREATE FUNCTION public.invalidate_entity_financial_readiness() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_entity uuid; new_entity uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN IF TG_TABLE_NAME='entities' THEN old_entity:=OLD.id; ELSIF TG_TABLE_NAME='posting_template_lines' THEN SELECT entity_id INTO old_entity FROM public.posting_templates WHERE id=OLD.template_id; ELSE old_entity:=OLD.entity_id; END IF; END IF;
 IF TG_OP<>'DELETE' THEN IF TG_TABLE_NAME='entities' THEN new_entity:=NEW.id; ELSIF TG_TABLE_NAME='posting_template_lines' THEN SELECT entity_id INTO new_entity FROM public.posting_templates WHERE id=NEW.template_id; ELSE new_entity:=NEW.entity_id; END IF; END IF;
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='entities' AND TG_OP='UPDATE' THEN
  IF (OLD.accounting_mode,OLD.base_currency,OLD.financial_year_start) IS DISTINCT FROM (NEW.accounting_mode,NEW.base_currency,NEW.financial_year_start) AND EXISTS(SELECT 1 FROM public.journals WHERE entity_id=NEW.id AND is_posted) THEN RAISE EXCEPTION 'Posted financial history requires a governed accounting policy transition'; END IF;
 END IF;
 IF current_setting('role',true) IN ('authenticated','anon') AND (
 (old_entity IS NOT NULL AND NOT public.can_manage_entity_financial_configuration(old_entity)) OR
 (new_entity IS NOT NULL AND NOT public.can_manage_entity_financial_configuration(new_entity))) THEN RAISE EXCEPTION 'Financial configuration authority required'; END IF;
 -- Stable order for cross-entity changes; ordinary imports never rebind records.
 INSERT INTO public.entity_financial_readiness(entity_id,revision)
 SELECT DISTINCT x,1 FROM unnest(ARRAY[old_entity,new_entity])x WHERE x IS NOT NULL ORDER BY x
 ON CONFLICT(entity_id) DO UPDATE SET revision=public.entity_financial_readiness.revision+1,reviewed_revision=NULL,reviewed_by=NULL,reviewed_at=NULL;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;$$;
REVOKE ALL ON FUNCTION public.invalidate_entity_financial_readiness() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER invalidate_coa_readiness AFTER INSERT OR UPDATE OR DELETE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();
CREATE TRIGGER invalidate_mapping_readiness AFTER INSERT OR UPDATE OR DELETE ON public.accounting_config FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();
CREATE TRIGGER invalidate_tax_readiness AFTER INSERT OR UPDATE OR DELETE ON public.tax_config FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();
CREATE TRIGGER invalidate_posting_template_readiness AFTER INSERT OR UPDATE OR DELETE ON public.posting_templates FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();
CREATE TRIGGER invalidate_posting_line_readiness AFTER INSERT OR UPDATE OR DELETE ON public.posting_template_lines FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();
CREATE TRIGGER invalidate_entity_policy_readiness AFTER UPDATE OF accounting_mode,base_currency,financial_year_start ON public.entities FOR EACH ROW EXECUTE FUNCTION public.invalidate_entity_financial_readiness();

CREATE FUNCTION public.review_entity_financial_configuration(p_entity uuid,p_revision bigint,p_vat_status text,p_accounting_mode text,p_currency text,p_year_start integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.entity_financial_readiness%ROWTYPE; result jsonb;
BEGIN
 IF NOT public.can_manage_entity_financial_configuration(p_entity) THEN RAISE EXCEPTION 'Financial configuration authority required'; END IF;
 IF p_vat_status IS NULL OR p_vat_status NOT IN ('registered','not_registered') OR p_accounting_mode IS NULL OR p_accounting_mode NOT IN ('cash','accrual') OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_year_start IS NULL OR p_year_start NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Explicit valid accounting and VAT choices required'; END IF;
 INSERT INTO public.entity_financial_readiness(entity_id) VALUES(p_entity) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.entity_financial_readiness WHERE entity_id=p_entity FOR UPDATE;
 IF s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Configuration changed; reload before review'; END IF;
 UPDATE public.entities SET accounting_mode=p_accounting_mode,base_currency=p_currency,financial_year_start=p_year_start WHERE id=p_entity AND (accounting_mode,base_currency,financial_year_start) IS DISTINCT FROM (p_accounting_mode,p_currency,p_year_start);
 UPDATE public.entity_financial_readiness SET vat_status=p_vat_status,revision=revision+1,reviewed_revision=NULL WHERE entity_id=p_entity AND vat_status IS DISTINCT FROM p_vat_status;
 result:=public.financial_configuration_state(p_entity);
 IF NOT (result->>'journal')::boolean THEN RAISE EXCEPTION 'Financial configuration incomplete: %',result->'issues'; END IF;
 UPDATE public.entity_financial_readiness SET reviewed_revision=revision,reviewed_by=auth.uid(),reviewed_at=now() WHERE entity_id=p_entity;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 VALUES(p_entity,'entity',p_entity,'configuration_reviewed','Client reviewed financial configuration',auth.uid(),'financial-configuration',public.get_entity_financial_readiness(p_entity));
 RETURN public.get_entity_financial_readiness(p_entity);
END;$$;
REVOKE ALL ON FUNCTION public.review_entity_financial_configuration(uuid,bigint,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_entity_financial_configuration(uuid,bigint,text,text,text,integer) TO authenticated;

CREATE FUNCTION public.assert_entity_financial_ready(p_entity uuid,p_operation text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_entity IS NULL OR p_operation NOT IN ('journal','receivable','payable','deposit') THEN RAISE EXCEPTION 'Financial readiness scope required'; END IF;
 PERFORM 1 FROM public.entity_financial_readiness WHERE entity_id=p_entity FOR SHARE;
 result:=public.financial_configuration_state(p_entity);
 IF NOT coalesce((result->>'reviewed')::boolean,false) OR NOT coalesce((result->>p_operation)::boolean,false) THEN RAISE EXCEPTION 'Financial configuration is not ready for %. Review entity financial setup.',p_operation; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.assert_entity_financial_ready(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_financial_readiness() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='journals' THEN
  IF NEW.is_posted AND (TG_OP='INSERT' OR OLD.is_posted IS DISTINCT FROM true OR OLD.entity_id IS DISTINCT FROM NEW.entity_id) THEN
   PERFORM public.assert_entity_financial_ready(NEW.entity_id,CASE NEW.source_event WHEN 'maintenance_supplier_invoice' THEN 'payable' WHEN 'lease_commencement_invoice' THEN 'receivable' ELSE 'journal' END);
  END IF;
 ELSIF TG_TABLE_NAME='charges' THEN
  IF NEW.status IN ('approved','posted') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN PERFORM public.assert_entity_financial_ready(NEW.entity_id,CASE WHEN NEW.charge_type='deposit' THEN 'deposit' ELSE 'receivable' END); END IF;
 ELSE
  IF NEW.invoice_status IN ('issued','paid') AND (TG_OP='INSERT' OR (OLD.invoice_status IS DISTINCT FROM 'issued' AND OLD.invoice_status IS DISTINCT FROM 'paid') OR OLD.entity_id IS DISTINCT FROM NEW.entity_id) THEN PERFORM public.assert_entity_financial_ready(NEW.entity_id,'receivable'); END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.guard_financial_readiness() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER financial_ready_journal BEFORE INSERT OR UPDATE ON public.journals FOR EACH ROW EXECUTE FUNCTION public.guard_financial_readiness();
CREATE TRIGGER financial_ready_charge BEFORE INSERT OR UPDATE ON public.charges FOR EACH ROW EXECUTE FUNCTION public.guard_financial_readiness();
CREATE TRIGGER financial_ready_invoice BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.guard_financial_readiness();

CREATE FUNCTION public.import_entity_financial_configuration(p_entity uuid,p_revision bigint,p_configuration jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x jsonb; a public.chart_of_accounts%ROWTYPE; t public.tax_config%ROWTYPE; m public.accounting_config%ROWTYPE; parent uuid; account uuid; revision_now bigint;
BEGIN
 IF NOT public.can_manage_entity_financial_configuration(p_entity) THEN RAISE EXCEPTION 'Financial configuration authority required'; END IF;
 IF jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' OR jsonb_typeof(p_configuration->'accounts') IS DISTINCT FROM 'array' OR jsonb_typeof(p_configuration->'taxes') IS DISTINCT FROM 'array' OR jsonb_typeof(p_configuration->'mappings') IS DISTINCT FROM 'array' OR length(p_configuration::text)>1000000 OR jsonb_array_length(p_configuration->'accounts')>1000 THEN RAISE EXCEPTION 'Provide accounts, taxes and mappings arrays within import limits'; END IF;
 INSERT INTO public.entity_financial_readiness(entity_id) VALUES(p_entity) ON CONFLICT DO NOTHING;
 SELECT revision INTO revision_now FROM public.entity_financial_readiness WHERE entity_id=p_entity FOR UPDATE;
 IF revision_now IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Configuration changed; reload before import'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_configuration->'accounts') LOOP
  IF nullif(btrim(x->>'code'),'') IS NULL OR nullif(btrim(x->>'name'),'') IS NULL OR nullif(btrim(x->>'category'),'') IS NULL OR x->>'type' IS NULL OR x->>'type' NOT IN ('asset','liability','equity','income','expense') OR x->>'vatCategory' IS NULL OR x->>'vatCategory' NOT IN ('standard','zero_rated','exempt','non_vatable') OR (x->>'vatRate')::numeric IS NULL OR (x->>'vatRate')::numeric NOT BETWEEN 0 AND 100 OR jsonb_typeof(x->'isVatable') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Each account requires explicit code, name, type, category and VAT classification'; END IF;
  IF (SELECT count(*) FROM public.chart_of_accounts WHERE entity_id=p_entity AND gl_code=x->>'code')>1 THEN RAISE EXCEPTION 'Duplicate existing account code requires reconciliation'; END IF;
  SELECT * INTO a FROM public.chart_of_accounts WHERE entity_id=p_entity AND gl_code=x->>'code';
  IF FOUND THEN
   IF (a.account_name,a.account_type,a.category,a.vat_category,a.vat_rate,a.is_vatable,a.is_active) IS DISTINCT FROM (x->>'name',x->>'type',x->>'category',x->>'vatCategory',(x->>'vatRate')::numeric,(x->>'isVatable')::boolean,true) THEN RAISE EXCEPTION 'Import conflicts with existing account %. Existing configuration was not overwritten.',x->>'code'; END IF;
  ELSE
   INSERT INTO public.chart_of_accounts(entity_id,gl_code,account_name,account_type,category,vat_category,vat_rate,is_vatable,is_active) VALUES(p_entity,x->>'code',x->>'name',x->>'type',x->>'category',x->>'vatCategory',(x->>'vatRate')::numeric,(x->>'isVatable')::boolean,true);
  END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_configuration->'accounts') LOOP
  SELECT * INTO STRICT a FROM public.chart_of_accounts WHERE entity_id=p_entity AND gl_code=x->>'code';
  parent:=NULL;
  IF nullif(x->>'parentCode','') IS NOT NULL THEN
   SELECT id INTO STRICT parent FROM public.chart_of_accounts WHERE entity_id=p_entity AND gl_code=x->>'parentCode';
  END IF;
  IF a.parent_account_id IS NOT NULL AND a.parent_account_id IS DISTINCT FROM parent THEN RAISE EXCEPTION 'Existing account hierarchy must not be overwritten'; END IF;
  IF a.id=parent THEN RAISE EXCEPTION 'Account cannot parent itself'; END IF;
  UPDATE public.chart_of_accounts SET parent_account_id=parent WHERE id=a.id AND parent_account_id IS DISTINCT FROM parent;
 END LOOP;
 IF EXISTS(WITH RECURSIVE walk AS (
 SELECT id,parent_account_id,ARRAY[id] path,false cycle FROM public.chart_of_accounts WHERE entity_id=p_entity
 UNION ALL SELECT p.id,p.parent_account_id,w.path||p.id,p.id=ANY(w.path) FROM walk w JOIN public.chart_of_accounts p ON p.id=w.parent_account_id WHERE NOT w.cycle
 ) SELECT 1 FROM walk WHERE cycle) THEN RAISE EXCEPTION 'Account hierarchy contains a cycle'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_configuration->'taxes') LOOP
  IF nullif(btrim(x->>'code'),'') IS NULL OR nullif(btrim(x->>'name'),'') IS NULL OR (x->>'rate')::numeric IS NULL OR (x->>'rate')::numeric NOT BETWEEN 0 AND 100 OR jsonb_typeof(x->'recoverable') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Explicit valid tax code, name, rate and recoverability required'; END IF;
  IF (SELECT count(*) FROM public.tax_config WHERE entity_id=p_entity AND tax_code=x->>'code')>1 THEN RAISE EXCEPTION 'Duplicate tax code requires reconciliation'; END IF;
  SELECT * INTO t FROM public.tax_config WHERE entity_id=p_entity AND tax_code=x->>'code';
  IF FOUND THEN
   IF (t.tax_name,t.tax_rate,t.is_recoverable,t.is_active) IS DISTINCT FROM (x->>'name',(x->>'rate')::numeric,(x->>'recoverable')::boolean,true) THEN RAISE EXCEPTION 'Import conflicts with existing tax code'; END IF;
  ELSE INSERT INTO public.tax_config(entity_id,tax_code,tax_name,tax_rate,is_recoverable,is_active) VALUES(p_entity,x->>'code',x->>'name',(x->>'rate')::numeric,(x->>'recoverable')::boolean,true); END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_configuration->'mappings') LOOP
  IF nullif(btrim(x->>'role'),'') IS NULL THEN RAISE EXCEPTION 'Explicit business role required'; END IF;
  SELECT id INTO STRICT account FROM public.chart_of_accounts WHERE entity_id=p_entity AND gl_code=x->>'accountCode' AND is_active;
  IF (SELECT count(*) FROM public.accounting_config WHERE entity_id=p_entity AND business_role=x->>'role' AND is_active)>1 THEN RAISE EXCEPTION 'Duplicate role requires reconciliation'; END IF;
  SELECT * INTO m FROM public.accounting_config WHERE entity_id=p_entity AND business_role=x->>'role' AND is_active;
  IF FOUND THEN
   IF m.account_id<>account THEN RAISE EXCEPTION 'Import conflicts with existing mapping'; END IF;
  ELSE INSERT INTO public.accounting_config(entity_id,business_role,account_id,is_active,configured_by) VALUES(p_entity,x->>'role',account,true,auth.uid()); END IF;
 END LOOP;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata) VALUES(p_entity,'entity',p_entity,'configuration_imported','Client supplied financial configuration',auth.uid(),'financial-configuration',jsonb_build_object('accounts',jsonb_array_length(p_configuration->'accounts'),'taxes',jsonb_array_length(p_configuration->'taxes'),'mappings',jsonb_array_length(p_configuration->'mappings')));
 RETURN public.get_entity_financial_readiness(p_entity);
END;$$;
REVOKE ALL ON FUNCTION public.import_entity_financial_configuration(uuid,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_entity_financial_configuration(uuid,bigint,jsonb) TO authenticated;
-- Protect configuration evidence without changing unrelated timeline behavior.
CREATE FUNCTION public.guard_financial_configuration_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
  IF OLD.event_type IN ('configuration_reviewed','configuration_imported') THEN RAISE EXCEPTION 'Financial configuration audit evidence is immutable'; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  IF NEW.event_type IN ('configuration_reviewed','configuration_imported') AND current_user IN ('anon','authenticated','service_role') THEN RAISE EXCEPTION 'Configuration audit requires canonical command'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END;$$;
REVOKE ALL ON FUNCTION public.guard_financial_configuration_audit() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER financial_configuration_audit_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_timeline FOR EACH ROW EXECUTE FUNCTION public.guard_financial_configuration_audit();
-- Even privileged legacy GL writers cannot bypass configuration readiness.
-- Existing canonical posting functions still own balance and ledger projection.
CREATE FUNCTION public.guard_gl_financial_readiness() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.journals%ROWTYPE; l public.journal_lines%ROWTYPE;
BEGIN
 SELECT * INTO l FROM public.journal_lines WHERE id=NEW.journal_line_id FOR UPDATE;
 SELECT * INTO j FROM public.journals WHERE id=l.journal_id AND is_posted;
 IF j.id IS NULL OR j.entity_id IS DISTINCT FROM NEW.entity_id THEN RAISE EXCEPTION 'GL requires a posted journal in the same entity'; END IF;
 PERFORM public.assert_entity_financial_ready(NEW.entity_id,CASE j.source_event WHEN 'maintenance_supplier_invoice' THEN 'payable' WHEN 'lease_commencement_invoice' THEN 'receivable' ELSE 'journal' END);
 IF NEW.account_id IS DISTINCT FROM l.account_id OR NEW.entity_id IS DISTINCT FROM l.entity_id OR NEW.period_id IS DISTINCT FROM j.period_id OR NEW.debit_amount IS DISTINCT FROM l.debit_amount OR NEW.credit_amount IS DISTINCT FROM l.credit_amount THEN RAISE EXCEPTION 'GL must match its canonical journal line'; END IF;
 IF EXISTS(SELECT 1 FROM public.general_ledger WHERE journal_line_id=NEW.journal_line_id) THEN RAISE EXCEPTION 'Journal line already projected to GL'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.guard_gl_financial_readiness() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER financial_ready_general_ledger BEFORE INSERT ON public.general_ledger FOR EACH ROW EXECUTE FUNCTION public.guard_gl_financial_readiness();
COMMIT;
