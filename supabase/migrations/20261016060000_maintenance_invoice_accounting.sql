BEGIN;
ALTER TABLE public.supplier_invoices_new ADD COLUMN maintenance_work_order_id uuid REFERENCES public.work_orders(id), ADD COLUMN maintenance_capture jsonb;
INSERT INTO public.permission_catalogue(key,category,name,description) VALUES('invoices.capture','finance','Capture supplier invoices','Capture documented supplier invoice allocations') ON CONFLICT(key) DO NOTHING;
CREATE FUNCTION public.capture_maintenance_supplier_invoice(p_entity_id uuid,p_work_order_id uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE w public.work_orders%ROWTYPE;i public.supplier_invoices_new%ROWTYPE;d public.documents%ROWTYPE;x jsonb;a uuid;t numeric;n numeric;v numeric;s numeric:=0;tax numeric:=0;total numeric;v_lines jsonb:='[]';v_id uuid:=gen_random_uuid();v_number text:=nullif(btrim(p_input->>'invoiceNumber'),'');v_date date:=(p_input->>'invoiceDate')::date;v_due date:=(p_input->>'dueDate')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'invoices.capture'),false) OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'maintenance.work_order.manage'),false) THEN RAISE EXCEPTION 'Supplier invoice capture permission denied'; END IF;
 SELECT * INTO w FROM public.work_orders WHERE id=p_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance work order unavailable'; END IF;
 IF v_number IS NULL OR v_date IS NULL OR v_due IS NULL OR v_due<v_date OR jsonb_typeof(p_input->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'lines')=0 THEN RAISE EXCEPTION 'Explicit invoice number, dates and allocations required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_entity_id::text||':supplier-invoice:'||w.supplier_id::text||':'||lower(v_number),0));
 SELECT * INTO i FROM public.supplier_invoices_new WHERE entity_id=p_entity_id AND supplier_id=w.supplier_id AND lower(btrim(invoice_number))=lower(v_number) ORDER BY created_at LIMIT 1;
 IF FOUND THEN
  IF i.maintenance_work_order_id IS DISTINCT FROM w.id OR i.maintenance_capture IS DISTINCT FROM p_input THEN RAISE EXCEPTION 'Supplier invoice duplicate or changed replay requires reconciliation'; END IF;
  RETURN to_jsonb(i);
 END IF;
 IF w.status<>'verified' OR w.certified_by IS NULL OR w.tenant_chargeable THEN RAISE EXCEPTION 'Certified landlord work required; tenant recovery requires separate authority'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=w.supplier_id AND entity_id=p_entity_id AND is_active AND NOT blacklisted) THEN RAISE EXCEPTION 'Eligible entity supplier required'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=(p_input->>'documentId')::uuid AND entity_id=p_entity_id FOR SHARE;
 IF NOT FOUND OR d.requires_review IS DISTINCT FROM false OR d.checksum IS NULL OR d.checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Reviewed supplier invoice evidence required'; END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(p_input->'lines') LOOP
  n:=(x->>'amount')::numeric;
  IF n IS NULL OR n<=0 OR n<>round(n,2) OR n::text IN ('NaN','Infinity','-Infinity') OR nullif(btrim(x->>'description'),'') IS NULL THEN RAISE EXCEPTION 'Positive cent-precise allocation with description required'; END IF;
  IF x->>'propertyId' IS DISTINCT FROM w.property_id::text THEN RAISE EXCEPTION 'Invoice allocation property mismatch'; END IF;
  PERFORM 1 FROM public.chart_of_accounts WHERE entity_id=p_entity_id AND gl_code=x->>'glCode' AND is_active FOR SHARE;
  IF (SELECT count(*) FROM public.chart_of_accounts WHERE entity_id=p_entity_id AND gl_code=x->>'glCode' AND is_active AND account_type IN ('expense','asset'))<>1 THEN RAISE EXCEPTION 'One explicit entity cost allocation account required'; END IF;
  PERFORM 1 FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=x->>'vatCode' AND is_active FOR SHARE;
  IF (SELECT count(*) FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=x->>'vatCode' AND is_active)<>1 THEN RAISE EXCEPTION 'Explicit unambiguous invoice tax code required'; END IF;
  SELECT tax_rate INTO t FROM public.tax_config WHERE entity_id=p_entity_id AND tax_code=x->>'vatCode' AND is_active;
  IF t IS NULL OR t NOT BETWEEN 0 AND 100 OR (x->>'vatCode'='NO_VAT' AND t<>0) THEN RAISE EXCEPTION 'Invalid invoice tax configuration'; END IF;
  v:=round(n*t/100,2);s:=s+n;tax:=tax+v;v_lines:=v_lines||jsonb_build_array(x||jsonb_build_object('vatRate',t,'vatAmount',v,'total',n+v));
 END LOOP;
 total:=s+tax;
 IF total+(SELECT coalesce(sum(total_amount),0) FROM public.supplier_invoices_new WHERE maintenance_work_order_id=w.id)>w.actual_cost THEN RAISE EXCEPTION 'Invoice allocations exceed certified work cost'; END IF;
 INSERT INTO public.supplier_invoices_new(id,entity_id,supplier_id,invoice_number,invoice_date,due_date,description,total_amount,subtotal,vat_amount,status,lifecycle_status,source,document_id,created_by,requires_review,duplicate_checked,maintenance_work_order_id,maintenance_capture)
 VALUES(v_id,p_entity_id,w.supplier_id,v_number,v_date,v_due,p_input->>'description',total,s,tax,'draft','finance_review','maintenance',d.id,auth.uid(),true,true,w.id,p_input);
 FOR x IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
  INSERT INTO public.supplier_invoice_lines(invoice_id,property_id,gl_code,description,amount,vat_code,vat_rate,vat_amount,total,cost_centre)
  VALUES(v_id,w.property_id,x->>'glCode',x->>'description',(x->>'amount')::numeric,x->>'vatCode',(x->>'vatRate')::numeric,(x->>'vatAmount')::numeric,(x->>'total')::numeric,x->>'costCentre');
 END LOOP;
 INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type,evidence_sha256,command_result)
 VALUES(w.id,'invoice_captured',v_number,auth.uid(),'user',d.checksum,jsonb_build_object('invoiceId',v_id,'net',s,'vat',tax,'gross',total));
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=v_id;RETURN to_jsonb(i);
END;
$fn$;

CREATE FUNCTION public.approve_maintenance_supplier_invoice(p_entity_id uuid,p_invoice_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE i public.supplier_invoices_new%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'invoices.approve'),false) THEN RAISE EXCEPTION 'Invoice approval permission denied'; END IF;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id;
 PERFORM 1 FROM public.work_orders WHERE id=i.maintenance_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND OR i.maintenance_work_order_id IS NULL THEN RAISE EXCEPTION 'Maintenance invoice unavailable'; END IF;
 IF i.lifecycle_status IN ('approved','posted') THEN RETURN; END IF;
 IF i.lifecycle_status<>'finance_review' OR i.created_by=auth.uid() THEN RAISE EXCEPTION 'Independent invoice review required'; END IF;
 UPDATE public.supplier_invoices_new SET lifecycle_status='approved',approved_by=auth.uid(),requires_review=false,updated_at=now() WHERE id=i.id;
 INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type,command_result) VALUES(i.maintenance_work_order_id,'invoice_approved',i.invoice_number,auth.uid(),'user',jsonb_build_object('invoiceId',i.id));
END;
$fn$;

CREATE FUNCTION public.maintenance_invoice_posting_consistent(p_invoice uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.supplier_invoices_new i JOIN public.journals j ON j.id=i.journal_id AND j.entity_id=i.entity_id AND j.is_posted AND j.source_event='maintenance_supplier_invoice' AND j.source_id=i.id::text
 WHERE i.id=p_invoice AND i.maintenance_work_order_id IS NOT NULL
 AND (SELECT sum(l.debit_amount) FROM public.journal_lines l WHERE l.journal_id=j.id)=i.total_amount
 AND (SELECT sum(l.credit_amount) FROM public.journal_lines l WHERE l.journal_id=j.id)=i.total_amount
 AND NOT EXISTS(SELECT 1 FROM public.journal_lines l WHERE l.journal_id=j.id AND (SELECT count(*) FROM public.general_ledger g WHERE g.journal_line_id=l.id AND g.entity_id=j.entity_id AND g.account_id=l.account_id AND g.period_id=j.period_id AND g.debit_amount=l.debit_amount AND g.credit_amount=l.credit_amount)<>1)
 AND (SELECT count(*) FROM public.general_ledger g JOIN public.journal_lines l ON l.id=g.journal_line_id WHERE l.journal_id=j.id)=(SELECT count(*) FROM public.journal_lines WHERE journal_id=j.id)
 AND (SELECT count(*) FROM public.sub_ledger_entries s JOIN public.journal_lines l ON l.id=s.journal_line_id WHERE l.journal_id=j.id AND s.ledger_type='supplier')=1
 AND EXISTS(SELECT 1 FROM public.sub_ledger_entries s JOIN public.journal_lines l ON l.id=s.journal_line_id WHERE l.journal_id=j.id AND s.ledger_type='supplier' AND s.supplier_id=i.supplier_id AND s.entity_id=i.entity_id AND s.reference_id=i.id::text AND s.account_id=l.account_id AND s.debit_amount=0 AND s.credit_amount=i.total_amount AND l.supplier_id=i.supplier_id AND l.credit_amount=i.total_amount));
$fn$;
REVOKE ALL ON FUNCTION public.maintenance_invoice_posting_consistent(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.post_journal_supplier_ledger(p_journal_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE j public.journals%ROWTYPE;line public.journal_lines%ROWTYPE;v_ar uuid;v_count int;v_balance numeric;
BEGIN
 SELECT * INTO STRICT j FROM public.journals WHERE id=p_journal_id AND is_posted;
 IF NOT EXISTS(SELECT 1 FROM public.journal_lines WHERE journal_id=j.id AND supplier_id IS NOT NULL) THEN RETURN; END IF;
 PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id
   WHERE c.entity_id=j.entity_id AND c.business_role='ap_control' AND c.is_active FOR SHARE OF c,a;
 SELECT count(*),min(a.id::text)::uuid INTO v_count,v_ar FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active AND a.account_type='liability'
 WHERE c.entity_id=j.entity_id AND c.business_role='ap_control' AND c.is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'One entity AP control account required for supplier posting'; END IF;
 FOR line IN SELECT * FROM public.journal_lines WHERE journal_id=j.id AND supplier_id IS NOT NULL AND account_id=v_ar ORDER BY supplier_id,id LOOP
   IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=line.supplier_id AND entity_id=j.entity_id) THEN RAISE EXCEPTION 'Supplier ledger entity mismatch'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(j.entity_id::text||':supplier:'||line.supplier_id::text,0));
   IF EXISTS(SELECT 1 FROM public.sub_ledger_entries WHERE journal_line_id=line.id AND ledger_type='supplier') THEN CONTINUE; END IF;
   SELECT COALESCE(sum(debit_amount-credit_amount),0) INTO v_balance FROM public.sub_ledger_entries WHERE entity_id=j.entity_id AND supplier_id=line.supplier_id AND ledger_type='supplier';
   INSERT INTO public.sub_ledger_entries(entity_id,ledger_type,journal_line_id,account_id,reference_type,reference_id,description,debit_amount,credit_amount,running_balance,supplier_id,property_id,lease_id)
   VALUES(j.entity_id,'supplier',line.id,v_ar,CASE WHEN j.reference IS NOT NULL THEN 'invoice' ELSE j.source_event END,COALESCE(j.reference,j.id::text),line.description,line.debit_amount,line.credit_amount,v_balance+line.debit_amount-line.credit_amount,line.supplier_id,line.property_id,line.lease_id);
 END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.post_journal_supplier_ledger(uuid) FROM PUBLIC,anon,authenticated,service_role;


CREATE FUNCTION public.post_maintenance_supplier_invoice(p_entity_id uuid,p_invoice_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE i public.supplier_invoices_new%ROWTYPE;w public.work_orders%ROWTYPE;l public.supplier_invoice_lines%ROWTYPE;f public.financial_periods%ROWTYPE;
 ap uuid;vat uuid;account uuid;v_count int;net numeric:=0;tax numeric:=0;v_lines jsonb:='[]';j uuid:=gen_random_uuid();ap_line uuid:=gen_random_uuid();balance numeric;e public.work_order_events%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'invoices.post'),false) THEN RAISE EXCEPTION 'Invoice posting permission denied'; END IF;
 -- Consistent order: work order before invoice, shared with capture and closure.
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id;
 IF NOT FOUND OR i.maintenance_work_order_id IS NULL THEN RAISE EXCEPTION 'Maintenance invoice unavailable'; END IF;
 SELECT * INTO w FROM public.work_orders WHERE id=i.maintenance_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id FOR UPDATE;
 IF i.lifecycle_status='posted' THEN
  IF NOT public.maintenance_invoice_posting_consistent(i.id) OR NOT EXISTS(SELECT 1 FROM public.journals WHERE id=i.journal_id AND entity_id=p_entity_id AND is_posted AND source_event='maintenance_supplier_invoice' AND source_id=i.id::text) OR
    (SELECT coalesce(sum(credit_amount-debit_amount),0) FROM public.sub_ledger_entries WHERE entity_id=p_entity_id AND supplier_id=i.supplier_id AND ledger_type='supplier' AND reference_id=i.id::text) IS DISTINCT FROM i.total_amount THEN RAISE EXCEPTION 'Posted supplier invoice evidence requires reconciliation'; END IF;
  RETURN i.journal_id;
 END IF;
 IF i.lifecycle_status<>'approved' OR i.approved_by IS NULL OR i.requires_review OR w.status<>'verified' OR w.supplier_id IS DISTINCT FROM i.supplier_id THEN RAISE EXCEPTION 'Approved invoice and certified work required'; END IF;
 SELECT * INTO e FROM public.work_order_events WHERE work_order_id=w.id AND event_type='invoice_captured' AND command_result->>'invoiceId'=i.id::text;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.documents WHERE id=i.document_id AND entity_id=p_entity_id AND checksum=e.evidence_sha256 AND requires_review=false) THEN RAISE EXCEPTION 'Invoice evidence integrity changed'; END IF;
 PERFORM 1 FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND i.invoice_date BETWEEN period_start AND period_end FOR UPDATE;
 IF (SELECT count(*) FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND i.invoice_date BETWEEN period_start AND period_end)<>1 THEN RAISE EXCEPTION 'One entity accounting period required'; END IF;
 SELECT * INTO f FROM public.financial_periods WHERE entity_id=p_entity_id AND period_type='financial' AND i.invoice_date BETWEEN period_start AND period_end;
 IF f.status<>'open' THEN RAISE EXCEPTION 'Open accounting period required'; END IF;
 PERFORM 1 FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id WHERE c.entity_id=p_entity_id AND c.business_role IN ('ap_control','vat_input') AND c.is_active FOR SHARE OF c,a;
 SELECT count(*),min(a.id::text)::uuid INTO v_count,ap FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active AND a.account_type='liability' WHERE c.entity_id=p_entity_id AND c.business_role='ap_control' AND c.is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'One entity AP control liability required'; END IF;
 FOR l IN SELECT * FROM public.supplier_invoice_lines WHERE invoice_id=i.id ORDER BY id FOR SHARE LOOP
  IF l.property_id IS DISTINCT FROM w.property_id OR l.amount<=0 OR l.amount<>round(l.amount,2) OR l.vat_amount<0 OR l.vat_amount<>round(l.amount*l.vat_rate/100,2) OR l.total<>l.amount+l.vat_amount THEN RAISE EXCEPTION 'Invoice allocation integrity mismatch'; END IF;
  PERFORM 1 FROM public.chart_of_accounts WHERE entity_id=p_entity_id AND gl_code=l.gl_code AND is_active FOR SHARE;
  SELECT count(*),min(id::text)::uuid INTO v_count,account FROM public.chart_of_accounts WHERE entity_id=p_entity_id AND gl_code=l.gl_code AND is_active AND account_type IN ('expense','asset');
  IF v_count<>1 OR account=ap OR EXISTS(SELECT 1 FROM public.accounting_config WHERE entity_id=p_entity_id AND account_id=account AND business_role IN ('ar_control','ap_control','vat_input','vat_output','deposit_liability')) THEN RAISE EXCEPTION 'Cost allocation account requires reconciliation'; END IF;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'account_id',account,'entity_id',p_entity_id,'property_id',w.property_id,'description',l.description,'debit_amount',l.amount,'credit_amount',0));net:=net+l.amount;tax:=tax+l.vat_amount;
 END LOOP;
 IF net<=0 OR net IS DISTINCT FROM i.subtotal OR tax IS DISTINCT FROM i.vat_amount OR net+tax IS DISTINCT FROM i.total_amount THEN RAISE EXCEPTION 'Invoice totals require reconciliation'; END IF;
 IF tax>0 THEN
  SELECT count(*),min(a.id::text)::uuid INTO v_count,vat FROM public.accounting_config c JOIN public.chart_of_accounts a ON a.id=c.account_id AND a.entity_id=c.entity_id AND a.is_active AND a.account_type='asset' WHERE c.entity_id=p_entity_id AND c.business_role='vat_input' AND c.is_active;
  IF v_count<>1 THEN RAISE EXCEPTION 'One configured input VAT account required'; END IF;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'account_id',vat,'entity_id',p_entity_id,'property_id',w.property_id,'description','Input VAT','debit_amount',tax,'credit_amount',0));
 END IF;
 v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',ap_line,'account_id',ap,'entity_id',p_entity_id,'property_id',w.property_id,'supplier_id',i.supplier_id,'description',i.invoice_number,'debit_amount',0,'credit_amount',i.total_amount));
 PERFORM pg_advisory_xact_lock(hashtextextended('maintenance_supplier_invoice:'||i.id::text,0));
 IF EXISTS(SELECT 1 FROM public.journals WHERE source_event='maintenance_supplier_invoice' AND source_id=i.id::text) THEN RAISE EXCEPTION 'Existing partial supplier posting requires reconciliation'; END IF;
 j:=public.atomic_post_journal_internal(jsonb_build_object('id',j,'entity_id',p_entity_id,'journal_number','JNL-M-'||i.id::text,'journal_type','purchase_invoice','description',i.invoice_number,'period_id',f.id,'source_event','maintenance_supplier_invoice','source_id',i.id::text,'reference',i.id::text,'created_by',auth.uid()),v_lines);
 PERFORM public.post_journal_supplier_ledger(j);
 UPDATE public.supplier_invoices_new SET lifecycle_status='posted',status='posted',posted_by=auth.uid(),posted_at=now(),journal_id=j,updated_at=now() WHERE id=i.id;
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata) VALUES(p_entity_id,'supplier_invoice',i.id,'invoice_posted','Certified maintenance invoice and AP ledger posted',auth.uid(),'ap',jsonb_build_object('journal_id',j,'work_order_id',w.id));
 INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type,command_result) VALUES(w.id,'invoice_posted',i.invoice_number,auth.uid(),'user',jsonb_build_object('invoiceId',i.id,'journalId',j));
 RETURN j;
END;
$fn$;

CREATE FUNCTION public.close_maintenance_work_order(p_entity_id uuid,p_work_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE w public.work_orders%ROWTYPE;i public.supplier_invoices_new%ROWTYPE;gross numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'maintenance.work_order.certify'),false) THEN RAISE EXCEPTION 'Maintenance closure permission denied'; END IF;
 SELECT * INTO w FROM public.work_orders WHERE id=p_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND OR w.status NOT IN ('verified','closed') OR w.certified_by IS NULL THEN RAISE EXCEPTION 'Certified work order required'; END IF;
 FOR i IN SELECT * FROM public.supplier_invoices_new WHERE maintenance_work_order_id=w.id FOR SHARE LOOP
  IF i.lifecycle_status<>'posted' OR NOT public.maintenance_invoice_posting_consistent(i.id) OR NOT EXISTS(SELECT 1 FROM public.journals WHERE id=i.journal_id AND entity_id=p_entity_id AND is_posted AND source_id=i.id::text AND source_event='maintenance_supplier_invoice') OR
   (SELECT coalesce(sum(credit_amount-debit_amount),0) FROM public.sub_ledger_entries WHERE reference_id=i.id::text AND entity_id=p_entity_id AND supplier_id=i.supplier_id AND ledger_type='supplier') IS DISTINCT FROM i.total_amount THEN RAISE EXCEPTION 'Posted invoice and supplier ledger reconciliation required'; END IF;
  gross:=gross+i.total_amount;
 END LOOP;
 IF gross IS DISTINCT FROM w.actual_cost OR gross<=0 THEN RAISE EXCEPTION 'Supplier invoice allocations must equal certified cost before closure'; END IF;
 IF (SELECT count(*) FROM public.expected_supplier_invoices WHERE work_order_id=w.id AND entity_id=p_entity_id AND supplier_id=w.supplier_id AND expected_amount=w.actual_cost)<>1 THEN RAISE EXCEPTION 'Invoice expectation requires reconciliation'; END IF;
 IF w.status='closed' THEN RETURN to_jsonb(w); END IF;
 UPDATE public.expected_supplier_invoices SET status='matched' WHERE work_order_id=w.id AND entity_id=p_entity_id;
 UPDATE public.purchase_orders SET status='completed',completed_date=current_date WHERE id=w.purchase_order_id AND entity_id=p_entity_id;
 UPDATE public.work_orders SET status='closed',lifecycle_version=lifecycle_version+1,updated_at=now() WHERE id=w.id RETURNING * INTO w;
 INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type) VALUES(w.id,'closed','Certified work and supplier invoice allocations reconciled; payment remains in AP',auth.uid(),'user');
 RETURN to_jsonb(w);
END;
$fn$;

CREATE FUNCTION public.guard_maintenance_invoice_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF TG_TABLE_NAME='supplier_invoices_new' THEN
   IF (TG_OP<>'DELETE' AND NEW.maintenance_work_order_id IS NOT NULL) OR (TG_OP<>'INSERT' AND OLD.maintenance_work_order_id IS NOT NULL) THEN RAISE EXCEPTION 'Use governed maintenance invoice command'; END IF;
  ELSIF EXISTS(SELECT 1 FROM public.supplier_invoices_new WHERE maintenance_work_order_id IS NOT NULL AND id=CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END) OR
    (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.supplier_invoices_new WHERE maintenance_work_order_id IS NOT NULL AND id=OLD.invoice_id)) THEN RAISE EXCEPTION 'Maintenance invoice allocations are immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$fn$;
CREATE TRIGGER governed_maintenance_invoice BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_invoices_new FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_invoice_write();
CREATE TRIGGER governed_maintenance_invoice_lines BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_invoice_lines FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_invoice_write();
REVOKE ALL ON FUNCTION public.guard_maintenance_invoice_write() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.capture_maintenance_supplier_invoice(uuid,uuid,jsonb),public.approve_maintenance_supplier_invoice(uuid,uuid),public.post_maintenance_supplier_invoice(uuid,uuid),public.close_maintenance_work_order(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.capture_maintenance_supplier_invoice(uuid,uuid,jsonb),public.approve_maintenance_supplier_invoice(uuid,uuid),public.post_maintenance_supplier_invoice(uuid,uuid),public.close_maintenance_work_order(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.atomic_post_journal(p_journal jsonb,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_entity uuid:=(p_journal->>'entity_id')::uuid;v_period public.financial_periods%ROWTYPE;
 v_line jsonb;v_result uuid;v_prior public.journals%ROWTYPE;v_debit numeric;v_credit numeric;v_normal jsonb;v_existing jsonb;
BEGIN
 IF p_journal->>'source_event' IN ('lease_commencement_invoice','maintenance_supplier_invoice') THEN RAISE EXCEPTION 'Use governed invoice issuance'; END IF;
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
   PERFORM public.post_journal_tenant_ledger(v_prior.id);PERFORM public.post_journal_supplier_ledger(v_prior.id);RETURN v_prior.id;
 END IF;
 SELECT * INTO v_period FROM public.financial_periods WHERE id=(p_journal->>'period_id')::uuid AND entity_id=v_entity AND period_type='financial' FOR UPDATE;
 IF NOT FOUND OR v_period.status<>'open' THEN RAISE EXCEPTION 'Open entity financial period required'; END IF;
 -- A registered account may not be moved/deactivated during posting.
 PERFORM 1 FROM public.chart_of_accounts WHERE id IN (SELECT (x->>'account_id')::uuid FROM jsonb_array_elements(p_lines)x) FOR SHARE;
 IF auth.uid() IS NOT NULL THEN p_journal:=p_journal||jsonb_build_object('created_by',auth.uid()); END IF;
 v_result:=public.atomic_post_journal_internal(p_journal,p_lines);
 PERFORM public.post_journal_tenant_ledger(v_result);
 PERFORM public.post_journal_supplier_ledger(v_result);
 INSERT INTO public.financial_timeline(entity_id,reference_type,reference_id,event_type,description,actor_id,source_engine,metadata)
 VALUES(v_entity,'journal',v_result,'journal_posted','Atomic financial posting',auth.uid(),'posting-engine',jsonb_build_object('source_event',p_journal->>'source_event','source_id',p_journal->>'source_id'));
 RETURN v_result;
END;
$function$;
-- Supplier control projection is written only inside the atomic journal transaction.
CREATE FUNCTION public.guard_supplier_control_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
BEGIN
 IF current_user IN ('anon','authenticated') AND ((TG_OP<>'DELETE' AND NEW.ledger_type='supplier') OR (TG_OP<>'INSERT' AND OLD.ledger_type='supplier')) THEN RAISE EXCEPTION 'Use atomic supplier ledger posting'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;$guard$;
CREATE TRIGGER governed_supplier_control_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.sub_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_control_ledger();
REVOKE ALL ON FUNCTION public.guard_supplier_control_ledger() FROM PUBLIC,anon,authenticated;
-- Restrict maintenance invoices even where a legacy permissive policy exists.
ALTER TABLE public.supplier_invoices_new ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_invoice_scope ON public.supplier_invoices_new AS RESTRICTIVE FOR SELECT TO authenticated USING(maintenance_work_order_id IS NULL OR public.can_read_maintenance_order(maintenance_work_order_id));
CREATE POLICY maintenance_invoice_read ON public.supplier_invoices_new FOR SELECT TO authenticated USING(maintenance_work_order_id IS NOT NULL AND public.can_read_maintenance_order(maintenance_work_order_id));
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_invoice_lines_scope ON public.supplier_invoice_lines AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.supplier_invoices_new i WHERE i.id=invoice_id));
CREATE POLICY maintenance_invoice_lines_read ON public.supplier_invoice_lines FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.supplier_invoices_new i WHERE i.id=invoice_id AND i.maintenance_work_order_id IS NOT NULL));
COMMIT;
