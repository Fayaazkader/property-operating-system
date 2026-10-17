BEGIN;
-- Flow coordinates canonical records; it never calculates or posts financial data.
INSERT INTO public.permission_catalogue(key,category,name,description,default_access,scope,is_active,assignable_by_client,super_user_inherent)
VALUES ('communications.statement.prepare','communications','Prepare statement communications','Read issued tenant statements and prepare reviewed communications',false,'client',true,true,false),
('communications.statement.send','communications','Approve statement communications','Approve exact recipients and documents for statement communications',false,'client',true,true,false)
ON CONFLICT(key) DO NOTHING;
CREATE TABLE public.flow_statement_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES auth.users(id), request_key uuid NOT NULL,
 instruction text NOT NULL, entity_id uuid, property_id uuid, tenant_id uuid, months integer NOT NULL CHECK(months BETWEEN 1 AND 12),
 status text NOT NULL CHECK(status IN ('clarification','blocked','preparing','review','submitting','submitted','failed','reconciliation_required')),
 choices jsonb NOT NULL DEFAULT '[]', snapshot jsonb, manifest jsonb, manifest_hash text, reason text,
 queue_id uuid, attempt_token uuid, approved_at timestamptz, expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_key)
);
ALTER TABLE public.flow_statement_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flow_statement_actions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.communications_queue ADD COLUMN flow_action_id uuid UNIQUE REFERENCES public.flow_statement_actions(id), ADD COLUMN flow_attachments jsonb;
-- Legacy queue policies include permissive reads; Flow attachments must never
-- inherit those. Private commands expose only authorised, actor-owned actions.
CREATE POLICY flow_queue_private ON public.communications_queue AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(flow_action_id IS NULL);
-- The legacy queue worker claims only 'queued'; governed Flow sends use separate
-- statuses on this SAME queue and cannot be picked up without approval validation.
CREATE FUNCTION public.flow_authorized(p_actor uuid,p_entity uuid,p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_entity_access WHERE user_id=p_actor AND entity_id=p_entity)
 AND coalesce(public.has_entity_permission(p_actor,p_entity,p_permission),false);
$$;
CREATE FUNCTION public.flow_statement_snapshot(p_entity uuid,p_property uuid,p_tenant uuid,p_months int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tenants%ROWTYPE; prefs public.communication_preferences%ROWTYPE; docs jsonb:='[]'; f public.financial_periods%ROWTYPE; s public.statements_generated%ROWTYPE; first_day date; n int; company text; property text;
BEGIN
 SELECT * INTO t FROM public.tenants WHERE id=p_tenant AND entity_id=p_entity AND NOT coalesce(is_archived,false) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tenant unavailable'; END IF;
 SELECT property_name INTO property FROM public.properties WHERE id=p_property AND entity_id=p_entity;
 IF property IS NULL OR NOT EXISTS(SELECT 1 FROM public.leases WHERE tenant_id=p_tenant AND property_id=p_property) THEN RAISE EXCEPTION 'Property account unavailable'; END IF;
 -- Existing statements are tenant-account scoped, not lease/property scoped.
 IF EXISTS(SELECT 1 FROM public.leases WHERE tenant_id=p_tenant AND property_id IS DISTINCT FROM p_property) THEN RAISE EXCEPTION 'This tenant has multiple property accounts; account-level statement scope needs review'; END IF;
 SELECT count(*) INTO n FROM public.communication_preferences WHERE entity_id=p_entity AND tenant_id=p_tenant;
 IF n<>1 THEN RAISE EXCEPTION 'Explicit unambiguous communication preferences required'; END IF;
 SELECT * INTO prefs FROM public.communication_preferences WHERE entity_id=p_entity AND tenant_id=p_tenant FOR SHARE;
 IF NOT coalesce(t.email_enabled,false) OR NOT coalesce(prefs.email_enabled,false) OR NOT coalesce('email'=ANY(prefs.preferred_channels),false) OR prefs.quiet_hours IS NOT NULL THEN RAISE EXCEPTION 'Email preference or permitted delivery time requires configuration'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_communication_prefs WHERE tenant_id=p_tenant AND event_type IN ('statement','statement_available','statement_generated','statement_ready') AND channel='email' AND NOT is_enabled) THEN RAISE EXCEPTION 'Tenant statement email is disabled'; END IF;
 IF t.statement_email IS NULL OR t.statement_email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' THEN RAISE EXCEPTION 'One approved statement email address is required'; END IF;
 SELECT entity_name INTO company FROM public.entities WHERE id=p_entity;
 FOR i IN REVERSE p_months..1 LOOP
  first_day:=(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')-make_interval(months=>i))::date;
  SELECT count(*) INTO n FROM public.financial_periods WHERE entity_id=p_entity AND period_type='statement' AND period_start=first_day AND period_end=(first_day+interval '1 month -1 day')::date;
  IF n<>1 THEN RAISE EXCEPTION 'One authoritative statement period required for %',first_day; END IF;
  SELECT * INTO f FROM public.financial_periods WHERE entity_id=p_entity AND period_type='statement' AND period_start=first_day AND period_end=(first_day+interval '1 month -1 day')::date FOR SHARE;
  SELECT count(*) INTO n FROM public.statements_generated WHERE entity_id=p_entity AND tenant_id=p_tenant AND status='issued' AND statement_data->>'period_id'=f.id::text;
  IF n<>1 THEN RAISE EXCEPTION 'One issued statement required for %; missing or competing versions need review',f.period_name; END IF;
  SELECT * INTO s FROM public.statements_generated WHERE entity_id=p_entity AND tenant_id=p_tenant AND status='issued' AND statement_data->>'period_id'=f.id::text FOR SHARE;
  IF jsonb_typeof(s.statement_data->'posted_lines') IS DISTINCT FROM 'array' OR s.statement_data->>'opening_balance' IS NULL OR s.statement_data->>'closing_balance' IS NULL THEN RAISE EXCEPTION 'Issued statement % lacks the supported posted-ledger snapshot',f.period_name; END IF;
  docs:=docs||jsonb_build_array(jsonb_build_object('id',s.id,'version',s.version,'period_id',f.id,'period',f.period_name,'start',f.period_start,'end',f.period_end,'data',s.statement_data));
 END LOOP;
 RETURN jsonb_build_object('entity_id',p_entity,'company',company,'property_id',p_property,'property',property,'tenant_id',t.id,'tenant',t.tenant_name,'recipient',t.statement_email,'preference',to_jsonb(prefs),'documents',docs,'period_rule','Previous completed calendar months; current month excluded');
END;$$;
CREATE FUNCTION public.prepare_flow_statements_as_actor(p_actor uuid,p_key uuid,p_instruction text,p_query text,p_months int,p_entity uuid DEFAULT NULL,p_property uuid DEFAULT NULL,p_tenant uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.flow_statement_actions%ROWTYPE; matches jsonb; c jsonb; snap jsonb; failure text;
BEGIN
 IF p_actor IS NULL OR p_key IS NULL OR coalesce(length(trim(p_query)),0) NOT BETWEEN 2 AND 150 OR coalesce(length(p_instruction),0) NOT BETWEEN 1 AND 500 OR coalesce(p_months,0) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid statement request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||p_key::text,0));
 SELECT * INTO a FROM public.flow_statement_actions WHERE actor_id=p_actor AND request_key=p_key;
 IF FOUND THEN
  IF a.instruction IS DISTINCT FROM p_instruction OR a.months<>p_months THEN RAISE EXCEPTION 'Request key reused with different instruction'; END IF;
  IF a.entity_id IS NOT NULL AND NOT public.flow_authorized(p_actor,a.entity_id,'communications.statement.prepare') THEN RAISE EXCEPTION 'Statement access denied'; END IF;
  SELECT coalesce(jsonb_agg(choice),'[]') INTO a.choices FROM jsonb_array_elements(a.choices)choice WHERE public.flow_authorized(p_actor,(choice->>'entity_id')::uuid,'communications.statement.prepare');
  RETURN to_jsonb(a)-'attempt_token';
 END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'tenant',x->>'property'),'[]') INTO matches FROM (
  SELECT DISTINCT jsonb_build_object('entity_id',t.entity_id,'property_id',p.id,'tenant_id',t.id,'tenant',t.tenant_name,'property',p.property_name,'company',e.entity_name) x
  FROM public.tenants t JOIN public.leases l ON l.tenant_id=t.id JOIN public.properties p ON p.id=l.property_id AND p.entity_id=t.entity_id JOIN public.entities e ON e.id=t.entity_id
  WHERE public.flow_authorized(p_actor,t.entity_id,'communications.statement.prepare') AND NOT coalesce(t.is_archived,false)
  AND (p_entity IS NULL OR t.entity_id=p_entity) AND (p_property IS NULL OR p.id=p_property) AND (p_tenant IS NULL OR t.id=p_tenant)
  AND NOT EXISTS(SELECT 1 FROM regexp_split_to_table(lower(trim(p_query)),'\s+') word WHERE position(word IN lower(coalesce(t.tenant_name,'')||' '||coalesce(p.property_name,'')))=0)
  LIMIT 21
 ) candidates;
 IF jsonb_array_length(matches)<>1 THEN
  INSERT INTO public.flow_statement_actions(actor_id,request_key,instruction,months,status,choices,reason)
  VALUES(p_actor,p_key,p_instruction,p_months,'clarification',matches,'Select one authorized tenant and property in Flow, or refine the name. No documents have been sent.') RETURNING * INTO a;
 ELSE
  c:=matches->0;
  BEGIN snap:=public.flow_statement_snapshot((c->>'entity_id')::uuid,(c->>'property_id')::uuid,(c->>'tenant_id')::uuid,p_months); EXCEPTION WHEN raise_exception THEN failure:=SQLERRM; END;
  INSERT INTO public.flow_statement_actions(actor_id,request_key,instruction,months,entity_id,property_id,tenant_id,status,snapshot,reason)
  VALUES(p_actor,p_key,p_instruction,p_months,(c->>'entity_id')::uuid,(c->>'property_id')::uuid,(c->>'tenant_id')::uuid,CASE WHEN failure IS NULL THEN 'preparing' ELSE 'blocked' END,snap,failure) RETURNING * INTO a;
 END IF;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 SELECT a.entity_id,'flow_statement',a.id::text,'flow_prepared','Statement communication preparation',p_actor,'flow',jsonb_build_object('status',a.status) WHERE a.entity_id IS NOT NULL;
 RETURN to_jsonb(a);
END;$$;
CREATE FUNCTION public.prepare_flow_statements(p_key uuid,p_instruction text,p_query text,p_months int,p_entity uuid DEFAULT NULL,p_property uuid DEFAULT NULL,p_tenant uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.prepare_flow_statements_as_actor(auth.uid(),p_key,p_instruction,p_query,p_months,p_entity,p_property,p_tenant); $$;
CREATE FUNCTION public.get_flow_statement(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.flow_statement_actions%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.flow_statement_actions WHERE id=p_id AND actor_id=auth.uid();
 IF NOT FOUND OR (a.entity_id IS NOT NULL AND NOT public.flow_authorized(auth.uid(),a.entity_id,'communications.statement.prepare')) THEN RAISE EXCEPTION 'Statement action unavailable'; END IF;
 -- Choices are filtered again after authority changes.
 SELECT coalesce(jsonb_agg(c),'[]') INTO a.choices FROM jsonb_array_elements(a.choices)c WHERE public.flow_authorized(auth.uid(),(c->>'entity_id')::uuid,'communications.statement.prepare');
 RETURN to_jsonb(a)-'attempt_token';
END;$$;
CREATE FUNCTION public.stage_flow_statement(p_id uuid,p_snapshot jsonb,p_manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.flow_statement_actions%ROWTYPE; d jsonb; idx int:=0;
BEGIN
 SELECT * INTO a FROM public.flow_statement_actions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.snapshot IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'Snapshot changed'; END IF;
 IF a.status='review' THEN RETURN to_jsonb(a)-'attempt_token'; END IF;
 IF a.status<>'preparing' OR NOT public.flow_authorized(a.actor_id,a.entity_id,'communications.statement.prepare') THEN RAISE EXCEPTION 'Preparation unavailable'; END IF;
 IF a.snapshot IS DISTINCT FROM public.flow_statement_snapshot(a.entity_id,a.property_id,a.tenant_id,a.months) THEN RAISE EXCEPTION 'Statement source changed; prepare a fresh request'; END IF;
 IF jsonb_typeof(p_manifest->'attachments') IS DISTINCT FROM 'array' OR jsonb_array_length(p_manifest->'attachments')<>a.months OR p_manifest->>'recipient' IS DISTINCT FROM a.snapshot->>'recipient' OR length(p_manifest::text)>10000000 OR coalesce(length(p_manifest->>'subject'),0)=0 OR coalesce(length(p_manifest->>'body'),0)=0 THEN RAISE EXCEPTION 'Invalid manifest'; END IF;
 FOR d IN SELECT * FROM jsonb_array_elements(p_manifest->'attachments') LOOP
  IF d->>'statement_id' IS DISTINCT FROM a.snapshot->'documents'->idx->>'id' OR d->>'type' IS DISTINCT FROM 'application/pdf' OR coalesce(d->>'sha256','') !~ '^[a-f0-9]{64}$' OR coalesce(length(d->>'content'),0)=0 OR d->>'sha256' IS DISTINCT FROM encode(sha256(decode(d->>'content','base64')),'hex') OR substring(decode(d->>'content','base64') FROM 1 FOR 5) IS DISTINCT FROM convert_to('%PDF-','UTF8') THEN RAISE EXCEPTION 'Invalid statement attachment'; END IF;
  idx:=idx+1;
 END LOOP;
 UPDATE public.flow_statement_actions SET manifest=p_manifest,manifest_hash=encode(sha256(convert_to(p_manifest::text,'UTF8')),'hex'),status='review',expires_at=now()+interval '30 minutes' WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata) VALUES(a.entity_id,'flow_statement',a.id::text,'flow_review_ready','Exact statement documents prepared for approval',a.actor_id,'flow',jsonb_build_object('manifest_hash',a.manifest_hash));
 RETURN to_jsonb(a)-'attempt_token';
END;$$;
CREATE FUNCTION public.claim_flow_statement(p_id uuid,p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.flow_statement_actions%ROWTYPE; q uuid;
BEGIN
 SELECT * INTO a FROM public.flow_statement_actions WHERE id=p_id AND actor_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT public.flow_authorized(auth.uid(),a.entity_id,'communications.statement.send') OR NOT public.flow_authorized(auth.uid(),a.entity_id,'communications.statement.prepare') THEN RAISE EXCEPTION 'Statement approval denied'; END IF;
 IF a.manifest_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'Approval does not match documents'; END IF;
 IF a.status IN ('submitted','submitting','reconciliation_required') THEN RETURN jsonb_build_object('status',a.status,'id',a.id); END IF;
 IF a.status NOT IN ('review','failed') OR a.expires_at<=now() OR a.expires_at IS NULL THEN RAISE EXCEPTION 'Approval expired or not ready'; END IF;
 IF a.snapshot IS DISTINCT FROM public.flow_statement_snapshot(a.entity_id,a.property_id,a.tenant_id,a.months) THEN RAISE EXCEPTION 'Recipient, preference or statement changed; prepare again'; END IF;
 -- Serialize the same verified document/recipient set, even across new request IDs.
 PERFORM pg_advisory_xact_lock(hashtextextended(a.snapshot::text,0));
 IF EXISTS(SELECT 1 FROM public.flow_statement_actions other WHERE other.id<>a.id AND other.snapshot=a.snapshot AND other.status IN ('submitting','submitted','reconciliation_required')) THEN RAISE EXCEPTION 'These statements already have a submission; reconcile the existing action instead of resending'; END IF;
 INSERT INTO public.communications_queue(entity_id,tenant_id,type,channel,recipient,subject,body,status,flow_action_id,flow_attachments)
 VALUES(a.entity_id,a.tenant_id,'statement','email',a.manifest->>'recipient',a.manifest->>'subject',a.manifest->>'body','flow_submitting',a.id,a.manifest->'attachments')
 ON CONFLICT(flow_action_id) DO UPDATE SET status='flow_submitting',last_error=NULL RETURNING id INTO q;
 UPDATE public.flow_statement_actions SET queue_id=q,status='submitting',attempt_token=gen_random_uuid(),approved_at=now() WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata) VALUES(a.entity_id,'flow_statement',a.id::text,'flow_approved','Approved exact statement send; provider outcome pending',auth.uid(),'flow',jsonb_build_object('manifest_hash',p_hash,'queue_id',q,'attempt',a.attempt_token));
 RETURN to_jsonb(a);
END;$$;
CREATE FUNCTION public.finish_flow_statement(p_id uuid,p_token uuid,p_outcome text,p_provider_id text,p_error text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.flow_statement_actions%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.flow_statement_actions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.attempt_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Send attempt unavailable'; END IF;
 IF a.status<>'submitting' THEN RETURN; END IF;
 IF p_outcome NOT IN ('submitted','failed','reconciliation_required') OR (p_outcome='submitted' AND coalesce(length(p_provider_id),0)=0) THEN RAISE EXCEPTION 'Invalid provider outcome'; END IF;
 UPDATE public.flow_statement_actions SET status=p_outcome,reason=left(p_error,500) WHERE id=p_id;
 UPDATE public.communications_queue SET status='flow_'||p_outcome,provider_message_id=p_provider_id,last_error=left(p_error,500),processed_at=now(),attempts=coalesce(attempts,0)+1 WHERE id=a.queue_id;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata) VALUES(a.entity_id,'flow_statement',a.id::text,'flow_'||p_outcome,'Provider submission outcome; not proof of delivery',a.actor_id,'flow',jsonb_build_object('attempt',p_token,'provider_id',p_provider_id));
END;$$;
-- Direct queue writes must not substitute approved recipients or attachments.
CREATE FUNCTION public.guard_flow_queue() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (TG_OP<>'INSERT' AND OLD.flow_action_id IS NOT NULL) OR (TG_OP<>'DELETE' AND NEW.flow_action_id IS NOT NULL) THEN
  IF current_user IN ('anon','authenticated','service_role') THEN RAISE EXCEPTION 'Flow queue requires canonical command'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;$$;
CREATE TRIGGER flow_queue_guard BEFORE INSERT OR UPDATE OR DELETE ON public.communications_queue FOR EACH ROW EXECUTE FUNCTION public.guard_flow_queue();
REVOKE ALL ON FUNCTION public.flow_authorized(uuid,uuid,text),public.flow_statement_snapshot(uuid,uuid,uuid,int),public.prepare_flow_statements_as_actor(uuid,uuid,text,text,int,uuid,uuid,uuid),public.stage_flow_statement(uuid,jsonb,jsonb),public.finish_flow_statement(uuid,uuid,text,text,text),public.guard_flow_queue() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stage_flow_statement(uuid,jsonb,jsonb),public.finish_flow_statement(uuid,uuid,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_flow_statements(uuid,text,text,int,uuid,uuid,uuid),public.get_flow_statement(uuid),public.claim_flow_statement(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_flow_statements(uuid,text,text,int,uuid,uuid,uuid),public.get_flow_statement(uuid),public.claim_flow_statement(uuid,text) TO authenticated;
CREATE FUNCTION public.guard_flow_audit() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP<>'INSERT' AND OLD.reference_type='flow_statement' THEN RAISE EXCEPTION 'Flow audit evidence is immutable'; END IF;
 IF TG_OP<>'DELETE' AND NEW.reference_type='flow_statement' AND current_user IN ('anon','authenticated','service_role') THEN RAISE EXCEPTION 'Flow audit requires canonical command'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;$$;
REVOKE ALL ON FUNCTION public.guard_flow_audit() FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY flow_audit_private ON public.financial_timeline AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(reference_type IS DISTINCT FROM 'flow_statement');
CREATE TRIGGER flow_audit_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_timeline FOR EACH ROW EXECUTE FUNCTION public.guard_flow_audit();
-- Extend the verified existing webhook inbox; no second provider/identity system.
ALTER FUNCTION public.process_whatsapp_maintenance(uuid) RENAME TO process_whatsapp_maintenance_existing;
REVOKE ALL ON FUNCTION public.process_whatsapp_maintenance_existing(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.process_whatsapp_maintenance(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.whatsapp_maintenance_inbox%ROWTYPE; b public.whatsapp_requester_bindings%ROWTYPE; n int; a jsonb; reply jsonb;
BEGIN
 SELECT * INTO r FROM public.whatsapp_maintenance_inbox WHERE id=p_id;
 IF r.payload->>'kind' IS DISTINCT FROM 'flow_statement' THEN RETURN public.process_whatsapp_maintenance_existing(p_id); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp:'||(r.payload->>'phone'),0));
 SELECT * INTO r FROM public.whatsapp_maintenance_inbox WHERE id=p_id FOR UPDATE;
 IF r.result IS NOT NULL THEN RETURN r.result; END IF;
 SELECT count(*) INTO n FROM public.whatsapp_requester_bindings WHERE phone=r.payload->>'phone' AND verified_at IS NOT NULL AND revoked_at IS NULL AND expires_at>now() AND public.flow_authorized(actor_id,entity_id,'communications.statement.prepare');
 IF n<>1 THEN reply:=jsonb_build_object('status','clarification','message','Please open Flow in your signed-in AssetFlow account to verify or select the correct property connection. I have not prepared or sent any statements.');
 ELSE
  SELECT * INTO b FROM public.whatsapp_requester_bindings WHERE phone=r.payload->>'phone' AND verified_at IS NOT NULL AND revoked_at IS NULL AND expires_at>now() AND public.flow_authorized(actor_id,entity_id,'communications.statement.prepare') FOR SHARE;
  a:=public.prepare_flow_statements_as_actor(b.actor_id,r.id,r.payload->>'body',r.payload->>'query',(r.payload->>'months')::int,b.entity_id,b.property_id,NULL);
  reply:=jsonb_build_object('status','flow_prepared','actionId',a->>'id','message','I have recorded your statement request. Open Flow in your signed-in AssetFlow account and enter reference '||(a->>'id')||' to resolve any gaps, review the recipient and documents, and approve. No email has been sent.');
 END IF;
 UPDATE public.whatsapp_maintenance_inbox SET result=reply,processed_at=now() WHERE id=p_id;
 RETURN reply;
END;$$;
REVOKE ALL ON FUNCTION public.process_whatsapp_maintenance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_maintenance(uuid) TO service_role;
COMMIT;
