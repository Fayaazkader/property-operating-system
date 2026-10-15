BEGIN;
-- Existing lowercase defaults violate the existing uppercase CHECK constraints.
-- Correct only defaults; never rewrite existing operational records.
ALTER TABLE public.units ALTER COLUMN occupancy_status SET DEFAULT 'Vacant';
ALTER TABLE public.units ALTER COLUMN operational_status SET DEFAULT 'Active';
INSERT INTO public.permission_catalogue(key,category,name,description)
VALUES('maintenance.work_order.create','maintenance','Prepare maintenance work orders','Prepare issue-bound work orders without approving expenditure') ON CONFLICT(key) DO NOTHING;
CREATE FUNCTION public.prepare_maintenance_work_order(p_entity_id uuid,p_issue_id uuid,p_property_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE i public.maintenance_issues%ROWTYPE;w public.work_orders%ROWTYPE;v_count int;v_priority text;v_sla public.maintenance_slas%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'maintenance.work_order.create'),false) THEN RAISE EXCEPTION 'Work order preparation permission denied'; END IF;
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
 VALUES(p_entity_id,i.property_id,i.unit_id,i.tenant_id,i.asset_id,i.id,i.title,i.description,v_priority,'reported',CASE WHEN i.tenant_id IS NOT NULL THEN 'tenant' ELSE 'other' END,i.id,auth.uid(),
   i.created_at+make_interval(hours=>v_sla.response_hours),i.created_at+make_interval(hours=>v_sla.resolution_hours),now()>i.created_at+make_interval(hours=>v_sla.response_hours)) RETURNING * INTO w;
 INSERT INTO public.work_order_events(work_order_id,event_type,description,changed_by,changed_by_type)
 VALUES(w.id,'reported','Work order prepared; expenditure is not authorized',auth.uid(),'user');
 INSERT INTO public.property_timeline(entity_id,property_id,event_type,title,description,reference_id,reference_type,source,created_by)
 VALUES(p_entity_id,i.property_id,'work_order_prepared',i.title,'Prepared from the canonical maintenance issue; approval and contractor assignment remain separate',w.id,'work_order','work-order-service',auth.uid());
 RETURN to_jsonb(w)||jsonb_build_object('timeline',(SELECT jsonb_agg(e ORDER BY created_at,id) FROM public.work_order_events e WHERE work_order_id=w.id));
END;
$function$;
REVOKE ALL ON FUNCTION public.prepare_maintenance_work_order(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_maintenance_work_order(uuid,uuid,uuid) TO authenticated;
-- Block the legacy browser insert path for issue-bound orders. Existing unrelated
-- operational work orders are preserved. Financial/assignment authority is not
-- implied by preparing a reported work order.
CREATE FUNCTION public.guard_issue_work_order_binding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF TG_OP='DELETE' AND OLD.issue_id IS NOT NULL THEN RAISE EXCEPTION 'Cancel an issue work order; preserve its audit history'; END IF;
 IF TG_OP='UPDATE' AND current_user IN ('anon','authenticated') AND NEW.issue_id IS NOT NULL AND OLD.issue_id IS DISTINCT FROM NEW.issue_id THEN RAISE EXCEPTION 'Use canonical issue work order preparation'; END IF;
 IF TG_OP='INSERT' AND NEW.issue_id IS NOT NULL AND current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'Use canonical issue work order preparation'; END IF;
 IF TG_OP='UPDATE' AND OLD.issue_id IS NOT NULL AND (NEW.issue_id,NEW.entity_id,NEW.property_id,NEW.unit_id,NEW.tenant_id,NEW.asset_id) IS DISTINCT FROM (OLD.issue_id,OLD.entity_id,OLD.property_id,OLD.unit_id,OLD.tenant_id,OLD.asset_id) THEN RAISE EXCEPTION 'Issue work order context is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$function$;
CREATE TRIGGER issue_work_order_binding BEFORE INSERT OR UPDATE OR DELETE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.guard_issue_work_order_binding();
REVOKE ALL ON FUNCTION public.guard_issue_work_order_binding() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.protect_work_order_event_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN RAISE EXCEPTION 'Work order audit history is immutable'; END;
$function$;
CREATE TRIGGER work_order_event_history BEFORE UPDATE OR DELETE ON public.work_order_events FOR EACH ROW EXECUTE FUNCTION public.protect_work_order_event_history();
REVOKE ALL ON FUNCTION public.protect_work_order_event_history() FROM PUBLIC,anon,authenticated;
COMMIT;
