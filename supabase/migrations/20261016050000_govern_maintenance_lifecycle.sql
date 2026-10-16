BEGIN;
-- Extend the existing operational records; no channel-specific workflow store.
ALTER TABLE public.work_orders ADD COLUMN lifecycle_version integer NOT NULL DEFAULT 0,
 ADD COLUMN approved_quote_id uuid REFERENCES public.maintenance_quotes(id),
 ADD COLUMN certified_by uuid, ADD COLUMN certified_at timestamptz;
ALTER TABLE public.maintenance_quotes ADD COLUMN work_order_id uuid REFERENCES public.work_orders(id),
 ADD COLUMN submitted_by uuid, ADD COLUMN tax_code text, ADD COLUMN vat_amount numeric(15,2),
 ADD COLUMN total_amount numeric(15,2), ADD COLUMN document_id uuid REFERENCES public.documents(id),
 ADD COLUMN document_sha256 text;
ALTER TABLE public.maintenance_approval_rules ADD COLUMN required_permission text REFERENCES public.permission_catalogue(key),
 ADD COLUMN allow_self_approval boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_order_events ADD COLUMN request_id uuid, ADD COLUMN command_payload jsonb,
 ADD COLUMN command_result jsonb, ADD COLUMN evidence_sha256 text;
CREATE UNIQUE INDEX work_order_command_replay ON public.work_order_events(work_order_id,request_id) WHERE request_id IS NOT NULL;
INSERT INTO public.permission_catalogue(key,category,name,description) VALUES
 ('maintenance.work_order.manage','maintenance','Manage maintenance lifecycle','Record quotes, schedules and execution evidence'),
 ('maintenance.work_order.approve','maintenance','Approve maintenance quotations','Subject to explicitly configured approval rules'),
 ('maintenance.work_order.authorize','maintenance','Authorize maintenance work','Issue an approved order to the selected contractor'),
 ('maintenance.work_order.certify','maintenance','Certify maintenance completion','Independent evidence review'),
 ('maintenance.policy.manage','maintenance','Configure maintenance authority','Manage explicit approval policy mappings') ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION public.command_maintenance_work_order(p_entity_id uuid,p_work_order_id uuid,p_request_id uuid,p_expected_version integer,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE w public.work_orders%ROWTYPE;q public.maintenance_quotes%ROWTYPE;r public.maintenance_approval_rules%ROWTYPE;
 e public.work_order_events%ROWTYPE;d public.documents%ROWTYPE;v_supplier public.suppliers%ROWTYPE;
 v_amount numeric;v_rate numeric;v_vat numeric;v_total numeric;v_id uuid;v_visit uuid;v_time timestamptz;
 v_authority jsonb:='[]';v_matches integer:=0;v_permission text;v_result jsonb;v_note text:=nullif(btrim(p_payload->>'note'),'');v_doc uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'maintenance.work_order.manage'),false) THEN RAISE EXCEPTION 'Maintenance command permission denied'; END IF;
 IF p_request_id IS NULL OR p_expected_version IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Request identity, version and object payload required'; END IF;
 IF p_action NOT IN ('quote','approve','reject_quote','authorize','accept','schedule','start','progress','complete','reject_completion','certify','cancel') THEN RAISE EXCEPTION 'Unsupported maintenance action'; END IF;
 SELECT * INTO w FROM public.work_orders WHERE id=p_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND OR w.issue_id IS NULL THEN RAISE EXCEPTION 'Canonical issue work order unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=w.property_id AND entity_id=p_entity_id) OR
    NOT EXISTS(SELECT 1 FROM public.maintenance_issues WHERE id=w.issue_id AND entity_id=p_entity_id AND property_id=w.property_id) THEN RAISE EXCEPTION 'Work order context requires reconciliation'; END IF;
 v_permission:=CASE p_action WHEN 'approve' THEN 'maintenance.work_order.approve' WHEN 'authorize' THEN 'maintenance.work_order.authorize' WHEN 'certify' THEN 'maintenance.work_order.certify' END;
 IF v_permission IS NOT NULL AND NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,v_permission),false) THEN RAISE EXCEPTION 'Maintenance action permission denied'; END IF;
 SELECT * INTO e FROM public.work_order_events WHERE work_order_id=w.id AND request_id=p_request_id;
 IF FOUND THEN
  IF e.changed_by IS DISTINCT FROM auth.uid() OR e.event_type IS DISTINCT FROM p_action OR e.command_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Command replay differs from original'; END IF;
  RETURN e.command_result;
 END IF;
 IF w.lifecycle_version<>p_expected_version THEN RAISE EXCEPTION 'Stale work order version; reload before acting'; END IF;
 IF w.status IN ('closed','cancelled') THEN RAISE EXCEPTION 'Terminal work order cannot advance'; END IF;
 IF v_note IS NULL THEN RAISE EXCEPTION 'An operational note is required'; END IF;
 IF p_action IN ('accept','schedule','start','progress','complete','reject_completion','certify') AND NOT EXISTS(
  SELECT 1 FROM public.maintenance_quotes approved_quote JOIN public.purchase_orders po ON po.id=w.purchase_order_id AND po.work_order_id=w.id AND po.entity_id=p_entity_id AND po.supplier_id=w.supplier_id AND po.status='approved' AND po.amount=approved_quote.total_amount
  WHERE approved_quote.id=w.approved_quote_id AND approved_quote.work_order_id=w.id AND approved_quote.entity_id=p_entity_id AND approved_quote.supplier_id=w.supplier_id AND approved_quote.status='approved' AND approved_quote.total_amount=w.quoted_amount
 ) THEN RAISE EXCEPTION 'Authorized quotation and purchase order require reconciliation'; END IF;

 IF p_action IN ('quote','accept','progress','complete','certify') THEN
  v_doc:=(p_payload->>'document_id')::uuid;
  SELECT * INTO d FROM public.documents WHERE id=v_doc AND entity_id=p_entity_id FOR SHARE;
  IF NOT FOUND OR d.requires_review IS DISTINCT FROM false OR d.checksum IS NULL OR d.checksum !~ '^[a-f0-9]{64}$' OR nullif(d.storage_key,'') IS NULL THEN RAISE EXCEPTION 'Reviewed entity document with integrity evidence required'; END IF;
 END IF;
 IF p_action='quote' THEN
  IF w.status NOT IN ('reported','triaged','quoted') THEN RAISE EXCEPTION 'Quotes cannot alter authorized work'; END IF;
  SELECT * INTO v_supplier FROM public.suppliers WHERE id=(p_payload->>'supplier_id')::uuid AND entity_id=p_entity_id FOR SHARE;
  IF NOT FOUND OR v_supplier.is_active IS DISTINCT FROM true OR v_supplier.blacklisted IS DISTINCT FROM false OR v_supplier.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Eligible entity contractor required'; END IF;
  v_amount:=(p_payload->>'amount_excl_vat')::numeric;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount<>round(v_amount,2) OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Explicit positive net quote amount required'; END IF;
  PERFORM 1 FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=p_payload->>'tax_code' AND is_active FOR SHARE;
  IF (SELECT count(*) FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=p_payload->>'tax_code' AND is_active)<>1 THEN RAISE EXCEPTION 'One explicit entity tax mapping required'; END IF;
  SELECT tax_rate INTO v_rate FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=p_payload->>'tax_code' AND is_active;
  IF v_rate IS NULL OR v_rate NOT BETWEEN 0 AND 100 OR (p_payload->>'tax_code'='NO_VAT' AND v_rate<>0) THEN RAISE EXCEPTION 'Invalid quotation tax mapping'; END IF;
  v_vat:=round(v_amount*v_rate/100,2);v_total:=v_amount+v_vat;
  INSERT INTO public.maintenance_quotes(issue_id,entity_id,supplier_id,amount,description,status,work_order_id,submitted_by,tax_code,vat_amount,total_amount,document_id,document_sha256)
  VALUES(w.issue_id,p_entity_id,v_supplier.id,v_amount,v_note,'received',w.id,auth.uid(),p_payload->>'tax_code',v_vat,v_total,d.id,d.checksum) RETURNING id INTO v_id;
  UPDATE public.work_orders SET status='quoted' WHERE id=w.id;
 ELSIF p_action IN ('approve','reject_quote') THEN
  IF w.status<>'quoted' THEN RAISE EXCEPTION 'Work order must be quoted'; END IF;
  SELECT * INTO q FROM public.maintenance_quotes WHERE id=(p_payload->>'quote_id')::uuid AND work_order_id=w.id AND entity_id=p_entity_id AND issue_id=w.issue_id FOR UPDATE;
  IF NOT FOUND OR q.status<>'received' THEN RAISE EXCEPTION 'Received work-order quote required'; END IF;
  PERFORM 1 FROM public.documents WHERE id=q.document_id FOR SHARE;
  IF p_action='reject_quote' THEN
   UPDATE public.maintenance_quotes SET status='rejected',notes=v_note WHERE id=q.id;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=q.document_id AND entity_id=p_entity_id AND checksum=q.document_sha256 AND requires_review=false) THEN RAISE EXCEPTION 'Quotation document integrity changed'; END IF;
   FOR r IN SELECT * FROM public.maintenance_approval_rules WHERE entity_id=p_entity_id AND is_active FOR SHARE LOOP
    IF r.condition_field<>'amount' OR r.condition_operator NOT IN ('<=','<','>=','>','=') OR r.required_permission IS NULL OR r.condition_value !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Configure explicit supported maintenance approval authority'; END IF;
    IF (CASE r.condition_operator WHEN '<=' THEN q.total_amount<=r.condition_value::numeric WHEN '<' THEN q.total_amount<r.condition_value::numeric WHEN '>=' THEN q.total_amount>=r.condition_value::numeric WHEN '>' THEN q.total_amount>r.condition_value::numeric ELSE q.total_amount=r.condition_value::numeric END) THEN
     v_matches:=v_matches+1;v_authority:=v_authority||jsonb_build_array(to_jsonb(r));
     IF NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,r.required_permission),false) OR (NOT r.allow_self_approval AND q.submitted_by=auth.uid()) THEN RAISE EXCEPTION 'Configured approval authority or separation of duties denied'; END IF;
    END IF;
   END LOOP;
   IF v_matches=0 THEN RAISE EXCEPTION 'No configured approval rule covers gross quotation amount'; END IF;
   UPDATE public.maintenance_quotes SET status='approved',approved_by=auth.uid(),approved_at=now(),notes=v_note WHERE id=q.id;
   UPDATE public.work_orders SET status='approved',approved_quote_id=q.id,quoted_amount=q.total_amount WHERE id=w.id;
  END IF;
 ELSIF p_action='authorize' THEN
  IF w.status<>'approved' OR w.approved_quote_id IS NULL THEN RAISE EXCEPTION 'Approved quotation required before authorization'; END IF;
  SELECT * INTO q FROM public.maintenance_quotes WHERE id=w.approved_quote_id AND work_order_id=w.id AND status='approved' FOR SHARE;
  PERFORM 1 FROM public.documents WHERE id=q.document_id FOR SHARE;
  IF NOT FOUND OR q.total_amount IS DISTINCT FROM w.quoted_amount OR NOT EXISTS(SELECT 1 FROM public.documents WHERE id=q.document_id AND entity_id=p_entity_id AND checksum=q.document_sha256 AND requires_review=false) THEN RAISE EXCEPTION 'Approved quotation evidence mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=q.supplier_id AND entity_id=p_entity_id AND is_active AND NOT blacklisted AND status='active') THEN RAISE EXCEPTION 'Contractor no longer eligible'; END IF;
  IF EXISTS(SELECT 1 FROM public.purchase_orders WHERE work_order_id=w.id) THEN RAISE EXCEPTION 'Existing purchase order requires reconciliation'; END IF;
  v_id:=gen_random_uuid();
  INSERT INTO public.purchase_orders(id,entity_id,work_order_id,supplier_id,po_number,description,amount,status,issued_date,approved_date,approved_by,approval_notes,created_by)
  VALUES(v_id,p_entity_id,w.id,q.supplier_id,'MWO-'||v_id::text,v_note,q.total_amount,'approved',current_date,q.approved_at::date,q.approved_by,v_note,auth.uid());
  UPDATE public.work_orders SET status='assigned',assigned_to=q.supplier_id,supplier_id=q.supplier_id,assigned_at=now(),purchase_order_id=v_id WHERE id=w.id;
  UPDATE public.maintenance_quotes SET converted_to_wo=w.id WHERE id=q.id;
 ELSIF p_action='accept' THEN
  IF w.status<>'assigned' THEN RAISE EXCEPTION 'Authorized assignment required'; END IF;
  UPDATE public.work_orders SET status='accepted' WHERE id=w.id;
 ELSIF p_action='schedule' THEN
  IF w.status NOT IN ('accepted','scheduled') THEN RAISE EXCEPTION 'Contractor acceptance required before scheduling'; END IF;
  v_time:=(p_payload->>'scheduled_at')::timestamptz;
  IF v_time IS NULL OR v_time<=now() OR v_time='infinity'::timestamptz THEN RAISE EXCEPTION 'Explicit future appointment required'; END IF;
  UPDATE public.supplier_visits SET status='cancelled',notes=v_note WHERE work_order_id=w.id AND status='scheduled';
  INSERT INTO public.supplier_visits(work_order_id,supplier_id,scheduled_at,status,notes) VALUES(w.id,w.supplier_id,v_time,'scheduled',v_note) RETURNING id INTO v_visit;
  UPDATE public.work_orders SET status='scheduled',scheduled_date=(v_time AT TIME ZONE 'Africa/Johannesburg')::date WHERE id=w.id;
 ELSIF p_action='start' THEN
  IF w.status<>'scheduled' THEN RAISE EXCEPTION 'Scheduled visit required'; END IF;
  IF (SELECT count(*) FROM public.supplier_visits WHERE work_order_id=w.id AND supplier_id=w.supplier_id AND status='scheduled')<>1 THEN RAISE EXCEPTION 'One scheduled contractor visit required'; END IF;
  UPDATE public.supplier_visits SET status='in_progress',arrived_at=now() WHERE work_order_id=w.id AND status='scheduled';
  UPDATE public.work_orders SET status='in_progress' WHERE id=w.id;
 ELSIF p_action='progress' THEN
  IF w.status<>'in_progress' THEN RAISE EXCEPTION 'Work must be in progress'; END IF;
 ELSIF p_action='complete' THEN
  IF w.status<>'in_progress' THEN RAISE EXCEPTION 'Work must be in progress'; END IF;
  v_total:=(p_payload->>'actual_cost')::numeric;
  IF v_total IS NULL OR v_total<0 OR v_total>w.quoted_amount OR v_total<>round(v_total,2) OR v_total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Actual gross cost must be within approved authority; variation requires review'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.work_order_events WHERE work_order_id=w.id AND event_type='progress') THEN RAISE EXCEPTION 'Progress evidence required before completion'; END IF;
  UPDATE public.supplier_visits SET status='completed',completed_at=now() WHERE work_order_id=w.id AND status='in_progress';
  UPDATE public.work_orders SET status='completed',actual_cost=v_total,completed_at=now() WHERE id=w.id;
 ELSIF p_action='reject_completion' THEN
  IF w.status<>'completed' THEN RAISE EXCEPTION 'Completed work required'; END IF;
  UPDATE public.work_orders SET status='in_progress',completed_at=NULL,actual_cost=NULL WHERE id=w.id;
  UPDATE public.supplier_visits SET status='in_progress',completed_at=NULL WHERE work_order_id=w.id AND status='completed';
 ELSIF p_action='certify' THEN
  IF w.status<>'completed' THEN RAISE EXCEPTION 'Completed work required before certification'; END IF;
  SELECT * INTO e FROM public.work_order_events WHERE work_order_id=w.id AND event_type='complete' ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.documents WHERE id=(e.command_payload->>'document_id')::uuid AND entity_id=p_entity_id AND checksum=e.evidence_sha256 AND requires_review=false) THEN RAISE EXCEPTION 'Completion evidence integrity changed'; END IF;
  IF e.changed_by=auth.uid() THEN RAISE EXCEPTION 'Independent completion certifier required'; END IF;
  IF EXISTS(SELECT 1 FROM public.expected_supplier_invoices WHERE work_order_id=w.id) THEN RAISE EXCEPTION 'Existing invoice expectation requires reconciliation'; END IF;
  INSERT INTO public.expected_supplier_invoices(work_order_id,supplier_id,entity_id,expected_amount,expected_date,status) VALUES(w.id,w.supplier_id,p_entity_id,w.actual_cost,current_date,'pending') RETURNING id INTO v_id;
  UPDATE public.work_orders SET status='verified',certified_by=auth.uid(),certified_at=now() WHERE id=w.id;
 ELSIF p_action='cancel' THEN
  IF w.status NOT IN ('reported','triaged','quoted','approved','assigned','accepted','scheduled') THEN RAISE EXCEPTION 'Executed work cannot be cancelled without financial reconciliation'; END IF;
  UPDATE public.purchase_orders SET status='cancelled' WHERE id=w.purchase_order_id;
  UPDATE public.supplier_visits SET status='cancelled',notes=v_note WHERE work_order_id=w.id AND status='scheduled';
  UPDATE public.work_orders SET status='cancelled' WHERE id=w.id;
 END IF;
 UPDATE public.work_orders SET lifecycle_version=lifecycle_version+1,updated_at=now() WHERE id=w.id RETURNING * INTO w;
 v_result:=jsonb_build_object('workOrder',to_jsonb(w),'recordId',v_id,'visitId',v_visit,'authority',v_authority);
 INSERT INTO public.work_order_events(work_order_id,event_type,description,note,changed_by,changed_by_type,request_id,command_payload,command_result,evidence_sha256)
 VALUES(w.id,p_action,'Canonical maintenance command',v_note,auth.uid(),'user',p_request_id,p_payload,v_result,d.checksum);
 INSERT INTO public.property_timeline(entity_id,property_id,event_type,title,description,reference_id,reference_type,source,created_by)
 VALUES(p_entity_id,w.property_id,'maintenance_'||p_action,w.title,v_note,w.id,'work_order','work-order-service',auth.uid());
 RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.command_maintenance_work_order(uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.command_maintenance_work_order(uuid,uuid,uuid,integer,text,jsonb) TO authenticated;

-- Browser mutation routes cannot bypass the command through generic repositories.
CREATE FUNCTION public.guard_maintenance_lifecycle_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF TG_TABLE_NAME='maintenance_approval_rules' THEN
   IF TG_OP='UPDATE' AND NEW.entity_id IS DISTINCT FROM OLD.entity_id THEN RAISE EXCEPTION 'Policy entity is immutable'; END IF;
   IF NOT COALESCE(public.has_entity_permission(auth.uid(),CASE WHEN TG_OP='DELETE' THEN OLD.entity_id ELSE NEW.entity_id END,'maintenance.policy.manage'),false) THEN RAISE EXCEPTION 'Maintenance policy permission denied'; END IF;
  ELSIF TG_TABLE_NAME='purchase_orders' THEN
   IF EXISTS(SELECT 1 FROM public.work_orders WHERE issue_id IS NOT NULL AND (id=CASE WHEN TG_OP='INSERT' THEN NEW.work_order_id ELSE OLD.work_order_id END OR id=CASE WHEN TG_OP='DELETE' THEN OLD.work_order_id ELSE NEW.work_order_id END)) THEN RAISE EXCEPTION 'Use governed maintenance lifecycle command'; END IF;
  ELSIF TG_TABLE_NAME='work_orders' THEN
   IF OLD.issue_id IS NOT NULL THEN RAISE EXCEPTION 'Issue work order is immutable outside governed maintenance lifecycle command'; END IF;
  ELSE
   RAISE EXCEPTION 'Use governed maintenance lifecycle command';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$fn$;
CREATE TRIGGER governed_work_order_updates BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_maintenance_quotes BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_quotes FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_maintenance_purchase_orders BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_supplier_visits BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_visits FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_invoice_expectations BEFORE INSERT OR UPDATE OR DELETE ON public.expected_supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_work_order_events BEFORE INSERT ON public.work_order_events FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
CREATE TRIGGER governed_maintenance_authority BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_approval_rules FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_lifecycle_write();
REVOKE ALL ON FUNCTION public.guard_maintenance_lifecycle_write() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.can_read_maintenance_order(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.work_orders w WHERE w.id=p_id AND auth.uid() IS NOT NULL AND
 (COALESCE(public.has_entity_permission(auth.uid(),w.entity_id,'maintenance.work_order.manage'),false) OR COALESCE(public.has_entity_permission(auth.uid(),w.entity_id,'maintenance.work_order.create'),false)));
$fn$;
REVOKE ALL ON FUNCTION public.can_read_maintenance_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_maintenance_order(uuid) TO authenticated;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_scope_read ON public.work_orders FOR SELECT TO authenticated USING (public.can_read_maintenance_order(id));
CREATE POLICY maintenance_scope_restrict ON public.work_orders AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_read_maintenance_order(id));
GRANT SELECT ON public.work_orders TO authenticated;
ALTER TABLE public.maintenance_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_scope_read ON public.maintenance_quotes FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id) OR (work_order_id IS NULL AND auth.uid() IS NOT NULL AND coalesce(public.has_entity_permission(auth.uid(),entity_id,'maintenance.work_order.manage'),false)));
CREATE POLICY maintenance_scope_restrict ON public.maintenance_quotes AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id) OR (work_order_id IS NULL AND auth.uid() IS NOT NULL AND coalesce(public.has_entity_permission(auth.uid(),entity_id,'maintenance.work_order.manage'),false)));
GRANT SELECT ON public.maintenance_quotes TO authenticated;
ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_scope_read ON public.work_order_events FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
CREATE POLICY maintenance_scope_restrict ON public.work_order_events AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
GRANT SELECT ON public.work_order_events TO authenticated;
ALTER TABLE public.supplier_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_scope_read ON public.supplier_visits FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
CREATE POLICY maintenance_scope_restrict ON public.supplier_visits AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
GRANT SELECT ON public.supplier_visits TO authenticated;
ALTER TABLE public.expected_supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_scope_read ON public.expected_supplier_invoices FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
CREATE POLICY maintenance_scope_restrict ON public.expected_supplier_invoices AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_read_maintenance_order(work_order_id));
GRANT SELECT ON public.expected_supplier_invoices TO authenticated;
COMMIT;
