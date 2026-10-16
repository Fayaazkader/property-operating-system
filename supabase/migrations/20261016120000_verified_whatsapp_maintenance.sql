BEGIN;
CREATE FUNCTION public.prepare_maintenance_work_order_as_actor(p_entity_id uuid,p_issue_id uuid,p_property_id uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE i public.maintenance_issues%ROWTYPE;w public.work_orders%ROWTYPE;v_count int;v_priority text;v_sla public.maintenance_slas%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR NOT COALESCE(public.has_entity_permission(p_actor,p_entity_id,'maintenance.work_order.create'),false) THEN RAISE EXCEPTION 'Work order preparation permission denied'; END IF;
 SELECT * INTO i FROM public.maintenance_issues WHERE id=p_issue_id AND entity_id=p_entity_id AND property_id=p_property_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=i.property_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Maintenance issue scope mismatch'; END IF;
 SELECT count(*) INTO v_count FROM public.work_orders WHERE issue_id=i.id;
 IF v_count>1 THEN RAISE EXCEPTION 'Existing issue work orders require reconciliation'; END IF;
 IF v_count=1 THEN
   SELECT * INTO w FROM public.work_orders WHERE issue_id=i.id;
   IF w.entity_id IS DISTINCT FROM p_entity_id OR w.property_id IS DISTINCT FROM i.property_id OR w.unit_id IS DISTINCT FROM i.unit_id OR w.tenant_id IS DISTINCT FROM i.tenant_id OR w.asset_id IS DISTINCT FROM i.asset_id THEN RAISE EXCEPTION 'Existing work order scope mismatch'; END IF;
   RETURN to_jsonb(w)||jsonb_build_object('timeline',(SELECT COALESCE(jsonb_agg(e ORDER BY created_at,id),'[]') FROM public.work_order_events e WHERE work_order_id=w.id));
 END IF;
 IF i.created_at IS NULL THEN RAISE EXCEPTION 'Issue report date required'; END IF;
 IF i.status NOT IN ('reported','classified','approved','in_progress') OR i.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'Issue not eligible for preparation'; END IF;
 IF i.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units WHERE id=i.unit_id AND property_id=i.property_id) THEN RAISE EXCEPTION 'Maintenance unit scope mismatch'; END IF;
 IF i.tenant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=i.tenant_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Maintenance tenant scope mismatch'; END IF;
 IF i.lease_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leases WHERE id=i.lease_id AND property_id=i.property_id AND (i.unit_id IS NULL OR unit_id=i.unit_id) AND (i.tenant_id IS NULL OR tenant_id=i.tenant_id)) THEN RAISE EXCEPTION 'Maintenance lease context mismatch'; END IF;
 IF i.tenant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leases WHERE tenant_id=i.tenant_id AND property_id=i.property_id AND (i.unit_id IS NULL OR unit_id=i.unit_id)) THEN RAISE EXCEPTION 'Tenant has no lease context at this property'; END IF;
 IF i.asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assets WHERE id=i.asset_id AND property_id=i.property_id AND entity_id=p_entity_id) THEN RAISE EXCEPTION 'Maintenance asset requires canonical property/entity mapping'; END IF;
 v_priority:=CASE i.priority WHEN 'routine' THEN 'medium' WHEN 'urgent' THEN 'high' WHEN 'scheduled' THEN 'low' WHEN 'emergency' THEN 'emergency' END;
 IF v_priority IS NULL THEN RAISE EXCEPTION 'Unknown issue priority'; END IF;
 PERFORM 1 FROM public.maintenance_slas WHERE entity_id=p_entity_id AND priority=i.priority AND is_active FOR SHARE;
 SELECT count(*) INTO v_count FROM public.maintenance_slas WHERE entity_id=p_entity_id AND priority=i.priority AND is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'One configured entity maintenance SLA required'; END IF;
 SELECT * INTO v_sla FROM public.maintenance_slas WHERE entity_id=p_entity_id AND priority=i.priority AND is_active;
 IF v_sla.response_hours<0 OR v_sla.arrival_hours<0 OR v_sla.resolution_hours<=0 THEN RAISE EXCEPTION 'Invalid configured maintenance SLA'; END IF;
 INSERT INTO public.work_orders(entity_id,property_id,unit_id,tenant_id,asset_id,issue_id,title,description,priority,status,source,source_id,created_by,sla_response_at,sla_completed_at,sla_breached)
 VALUES(p_entity_id,i.property_id,i.unit_id,i.tenant_id,i.asset_id,i.id,i.title,i.description,v_priority,'reported',CASE WHEN i.tenant_id IS NOT NULL THEN 'tenant' ELSE 'other' END,i.id,p_actor,
   i.created_at+make_interval(hours=>v_sla.response_hours),i.created_at+make_interval(hours=>v_sla.resolution_hours),now()>i.created_at+make_interval(hours=>v_sla.response_hours)) RETURNING * INTO w;
 INSERT INTO public.work_order_events(work_order_id,event_type,description,changed_by,changed_by_type)
 VALUES(w.id,'reported','Work order prepared; expenditure is not authorized',p_actor,'user');
 INSERT INTO public.property_timeline(entity_id,property_id,event_type,title,description,reference_id,reference_type,source,created_by)
 VALUES(p_entity_id,i.property_id,'work_order_prepared',i.title,'Prepared from the canonical maintenance issue; approval and contractor assignment remain separate',w.id,'work_order','work-order-service',p_actor);
 RETURN to_jsonb(w)||jsonb_build_object('timeline',(SELECT jsonb_agg(e ORDER BY created_at,id) FROM public.work_order_events e WHERE work_order_id=w.id));
END;
$function$;
REVOKE ALL ON FUNCTION public.prepare_maintenance_work_order_as_actor(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.prepare_maintenance_work_order(p_entity_id uuid,p_issue_id uuid,p_property_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.prepare_maintenance_work_order_as_actor(p_entity_id,p_issue_id,p_property_id,auth.uid()); $$;
-- Transport identity and inbox are not a second maintenance model.
CREATE TABLE public.whatsapp_requester_bindings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,entity_id uuid NOT NULL,property_id uuid NOT NULL,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'),code_hash text NOT NULL UNIQUE CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),challenge_expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 verified_at timestamptz,expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',revoked_at timestamptz
);
CREATE TABLE public.whatsapp_maintenance_inbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider_id text NOT NULL UNIQUE,payload jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),result jsonb,processed_at timestamptz,issue_id uuid,work_order_id uuid,
 selected_binding uuid REFERENCES public.whatsapp_requester_bindings(id)
);
ALTER TABLE public.whatsapp_requester_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_maintenance_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_requester_bindings,public.whatsapp_maintenance_inbox FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.start_whatsapp_pairing(p_entity uuid,p_property uuid,p_phone text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.has_entity_permission(auth.uid(),p_entity,'maintenance.work_order.create'),false) THEN RAISE EXCEPTION 'Maintenance requester permission denied';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=p_property AND entity_id=p_entity) THEN RAISE EXCEPTION 'Property scope mismatch';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_phone,0));
 UPDATE public.whatsapp_requester_bindings SET revoked_at=now() WHERE actor_id=auth.uid() AND phone=p_phone AND entity_id=p_entity AND property_id=p_property AND revoked_at IS NULL;
 INSERT INTO public.whatsapp_requester_bindings(actor_id,entity_id,property_id,phone,code_hash) VALUES(auth.uid(),p_entity,p_property,p_phone,p_hash) RETURNING id INTO result;RETURN result;
END;$$;
CREATE FUNCTION public.revoke_whatsapp_pairing(p_binding uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN UPDATE public.whatsapp_requester_bindings SET revoked_at=now() WHERE id=p_binding AND actor_id=auth.uid();END;$$;
REVOKE ALL ON FUNCTION public.start_whatsapp_pairing(uuid,uuid,text,text),public.revoke_whatsapp_pairing(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_pairing(uuid,uuid,text,text),public.revoke_whatsapp_pairing(uuid) TO authenticated;
CREATE FUNCTION public.receive_whatsapp_maintenance(p_provider_id text,p_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.whatsapp_maintenance_inbox%ROWTYPE;
BEGIN
 IF p_provider_id IS NULL OR length(p_provider_id)>150 OR jsonb_typeof(p_payload)<>'object' OR length(p_payload::text)>131072 THEN RAISE EXCEPTION 'Invalid provider envelope';END IF;
 INSERT INTO public.whatsapp_maintenance_inbox(provider_id,payload) VALUES(p_provider_id,p_payload) ON CONFLICT(provider_id) DO NOTHING;
 SELECT * INTO r FROM public.whatsapp_maintenance_inbox WHERE provider_id=p_provider_id FOR UPDATE;
 IF r.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Provider replay payload differs';END IF;RETURN r.id;
END;$$;
CREATE FUNCTION public.process_whatsapp_maintenance(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.whatsapp_maintenance_inbox%ROWTYPE;b public.whatsapp_requester_bindings%ROWTYPE;choices jsonb;body text;v_phone text;reply jsonb;issue uuid;wo jsonb;pending public.whatsapp_maintenance_inbox%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.whatsapp_maintenance_inbox WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inbound message missing';END IF;
 v_phone:=r.payload->>'phone';PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp:'||v_phone,0));
 SELECT * INTO r FROM public.whatsapp_maintenance_inbox WHERE id=p_id FOR UPDATE;
 IF r.result IS NOT NULL THEN RETURN r.result;END IF;
 body:=trim(coalesce(r.payload->>'body',''));
 IF r.payload->>'pairingHash' IS NOT NULL THEN
  SELECT * INTO b FROM public.whatsapp_requester_bindings x WHERE x.phone=v_phone AND x.code_hash=r.payload->>'pairingHash' AND x.verified_at IS NULL AND x.revoked_at IS NULL AND x.challenge_expires_at>now() FOR UPDATE;
  IF FOUND AND coalesce(public.has_entity_permission(b.actor_id,b.entity_id,'maintenance.work_order.create'),false) THEN
   UPDATE public.whatsapp_requester_bindings SET verified_at=now() WHERE id=b.id;
   reply:=jsonb_build_object('status','paired','message','Your AssetFlow account is connected for maintenance requests at the property you selected. Describe the issue when you are ready.');
  ELSE reply:=jsonb_build_object('status','verification_required','message','That connection code is invalid or expired. Please generate a new code from your signed-in AssetFlow account.');END IF;
 ELSE
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'property',p.property_name) ORDER BY x.id),'[]') INTO choices FROM public.whatsapp_requester_bindings x JOIN public.properties p ON p.id=x.property_id AND p.entity_id=x.entity_id
  WHERE x.phone=v_phone AND x.verified_at IS NOT NULL AND x.revoked_at IS NULL AND x.expires_at>now() AND coalesce(public.has_entity_permission(x.actor_id,x.entity_id,'maintenance.work_order.create'),false);
  IF jsonb_array_length(choices)=0 THEN
   reply:=jsonb_build_object('status','verification_required','message','This is AssetFlow. Please connect your number from your signed-in account before I access property records or log a request. If this is urgent, use your established emergency contact.');
  ELSIF r.payload->>'kind'='unsupported_media' THEN
   reply:=jsonb_build_object('status','unsupported_media','message','I have not attached or processed this media. Please use the secure AssetFlow document workspace and send a text description here to log maintenance.');
  ELSIF r.payload->>'kind' NOT IN ('maintenance','selection') OR r.payload->>'kind' IS NULL THEN
   reply:=jsonb_build_object('status','clarification','message','I can log a maintenance issue through this connection. Please describe the problem and affected area. Other account requests need the authorized AssetFlow workspace.');
  ELSE
   IF r.payload->>'kind'='selection' THEN
    SELECT * INTO pending FROM public.whatsapp_maintenance_inbox WHERE ((r.payload->>'pendingId' IS NULL) OR id=(r.payload->>'pendingId')::uuid) AND payload->>'phone'=v_phone AND result->>'status'='select_property' AND received_at>now()-interval '10 minutes' ORDER BY received_at DESC,id DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Property selection expired or unavailable';END IF;
    SELECT * INTO b FROM public.whatsapp_requester_bindings WHERE id=coalesce((r.payload->>'bindingId')::uuid,(pending.result->'choices'->((r.payload->>'selection')::int-1)->>'id')::uuid) AND id IN(SELECT (v->>'id')::uuid FROM jsonb_array_elements(choices)v);
    IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pending.result->'choices')v WHERE v->>'id'=b.id::text) THEN RAISE EXCEPTION 'Unauthorized property selection';END IF;
    body:=pending.payload->>'body';
   ELSIF jsonb_array_length(choices)=1 THEN SELECT * INTO b FROM public.whatsapp_requester_bindings WHERE id=(choices->0->>'id')::uuid;
   ELSE reply:=jsonb_build_object('status','select_property','message','Which property is affected? Select one of your authorized properties so I log this in the right place.','choices',choices,'pendingId',r.id);END IF;
   IF b.id IS NOT NULL THEN
    -- Re-lock and recheck authorization immediately before the canonical mutation.
    SELECT * INTO b FROM public.whatsapp_requester_bindings WHERE id=b.id AND revoked_at IS NULL AND expires_at>now() FOR SHARE;
    IF NOT FOUND OR NOT coalesce(public.has_entity_permission(b.actor_id,b.entity_id,'maintenance.work_order.create'),false) THEN RAISE EXCEPTION 'Requester authority expired';END IF;
    INSERT INTO public.maintenance_issues(entity_id,property_id,title,description,priority,status,reported_via,reported_by)
    VALUES(b.entity_id,b.property_id,left(body,120),body,CASE WHEN coalesce(pending.payload,r.payload)->>'priority'='emergency' THEN 'emergency' ELSE 'routine' END,'reported','whatsapp',b.actor_id::text) RETURNING id INTO issue;
    wo:=public.prepare_maintenance_work_order_as_actor(b.entity_id,issue,b.property_id,b.actor_id);
    reply:=jsonb_build_object('status','created','workOrderId',wo->>'id','propertyId',b.property_id,'message','Your maintenance request has been recorded. Contractor appointment and work authorization still require the responsible team’s approval.');
    UPDATE public.whatsapp_maintenance_inbox SET issue_id=issue,work_order_id=(wo->>'id')::uuid,selected_binding=b.id WHERE id IN(r.id,pending.id);
    IF pending.id IS NOT NULL THEN UPDATE public.whatsapp_maintenance_inbox SET result=reply,processed_at=now() WHERE id=pending.id;END IF;
   END IF;
  END IF;
 END IF;
 UPDATE public.whatsapp_maintenance_inbox SET result=reply,processed_at=now() WHERE id=r.id;
 RETURN reply;
END;$$;
REVOKE ALL ON FUNCTION public.receive_whatsapp_maintenance(text,jsonb),public.process_whatsapp_maintenance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.receive_whatsapp_maintenance(text,jsonb),public.process_whatsapp_maintenance(uuid) TO service_role;
CREATE FUNCTION public.list_whatsapp_pairing_properties() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'entityId',entity_id,'name',property_name) ORDER BY property_name,id),'[]') FROM public.properties WHERE auth.uid() IS NOT NULL AND coalesce(public.has_entity_permission(auth.uid(),entity_id,'maintenance.work_order.create'),false);
$$;
REVOKE ALL ON FUNCTION public.list_whatsapp_pairing_properties() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.list_whatsapp_pairing_properties() TO authenticated;
COMMIT;
