BEGIN;
-- Reuse bank allocations. Receivable invoice_id keeps its existing FK semantics.
ALTER TABLE public.transaction_allocations ADD COLUMN supplier_invoice_id uuid REFERENCES public.supplier_invoices_new(id), ADD COLUMN payment_journal_id uuid REFERENCES public.journals(id);
ALTER TABLE public.supplier_invoices_new ADD COLUMN maintenance_paid_amount numeric(15,2) NOT NULL DEFAULT 0;
INSERT INTO public.permission_catalogue(key,category,name,description) VALUES('finance.supplier_payment.allocate','finance','Reconcile supplier payment allocations','Bind verified posted bank allocations to supplier invoices') ON CONFLICT(key) DO NOTHING;
CREATE FUNCTION public.maintenance_payment_evidence_valid(p_allocation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.transaction_allocations a
 JOIN public.supplier_invoices_new i ON i.id=a.supplier_invoice_id AND i.maintenance_work_order_id IS NOT NULL
 JOIN public.bank_transactions bt ON bt.id=a.transaction_id AND bt.transaction_amount<0
 JOIN public.bank_accounts ba ON ba.id=bt.bank_account_id AND ba.entity_id=i.entity_id
 JOIN public.bank_statements bs ON bs.id=bt.statement_id AND bs.bank_account_id=bt.bank_account_id AND bs.entity_id=i.entity_id AND bs.coverage_verified_at IS NOT NULL AND bs.coverage_verified_by IS NOT NULL AND bt.transaction_date BETWEEN bs.coverage_start AND bs.coverage_end
 JOIN public.journals j ON j.id=a.payment_journal_id AND j.entity_id=i.entity_id AND j.source_event='supplier_payment_made' AND j.source_id=bt.id::text AND j.is_posted
 WHERE a.id=p_allocation AND a.supplier_id=i.supplier_id AND a.invoice_id IS NULL AND a.is_payment AND a.amount>0
 AND (SELECT coalesce(sum(amount),0) FROM public.transaction_allocations WHERE transaction_id=bt.id)=abs(bt.transaction_amount)
 AND (SELECT coalesce(sum(l.debit_amount-l.credit_amount),0) FROM public.journal_lines l JOIN public.sub_ledger_entries s ON s.journal_line_id=l.id AND s.ledger_type='supplier' AND s.supplier_id=i.supplier_id AND s.entity_id=i.entity_id AND s.debit_amount=l.debit_amount AND s.credit_amount=l.credit_amount WHERE l.journal_id=j.id AND l.supplier_id=i.supplier_id)=abs(bt.transaction_amount)
 AND (SELECT coalesce(sum(credit_amount-debit_amount),0) FROM public.journal_lines WHERE journal_id=j.id AND bank_account_id=bt.bank_account_id)=abs(bt.transaction_amount)
 AND (SELECT sum(debit_amount-credit_amount) FROM public.journal_lines WHERE journal_id=j.id)=0
 AND NOT EXISTS(SELECT 1 FROM public.journal_lines l WHERE l.journal_id=j.id AND (SELECT count(*) FROM public.general_ledger g WHERE g.journal_line_id=l.id AND g.entity_id=j.entity_id AND g.account_id=l.account_id AND g.period_id=j.period_id AND g.debit_amount=l.debit_amount AND g.credit_amount=l.credit_amount)<>1));
$fn$;
REVOKE ALL ON FUNCTION public.maintenance_payment_evidence_valid(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.reconcile_maintenance_supplier_payment(p_entity_id uuid,p_invoice_id uuid,p_allocation_id uuid) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE i public.supplier_invoices_new%ROWTYPE;a public.transaction_allocations%ROWTYPE;bt public.bank_transactions%ROWTYPE;j uuid;paid numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'finance.supplier_payment.allocate'),false) THEN RAISE EXCEPTION 'Supplier payment allocation permission denied'; END IF;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id;
 PERFORM 1 FROM public.work_orders WHERE id=i.maintenance_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND OR i.maintenance_work_order_id IS NULL OR i.lifecycle_status<>'posted' OR NOT public.maintenance_invoice_posting_consistent(i.id) THEN RAISE EXCEPTION 'Posted reconciled maintenance invoice required'; END IF;
 SELECT * INTO a FROM public.transaction_allocations WHERE id=p_allocation_id;
 SELECT * INTO bt FROM public.bank_transactions WHERE id=a.transaction_id FOR UPDATE;
 SELECT * INTO a FROM public.transaction_allocations WHERE id=p_allocation_id FOR UPDATE;
 IF NOT FOUND OR a.supplier_id IS DISTINCT FROM i.supplier_id OR a.invoice_id IS NOT NULL OR a.is_payment IS DISTINCT FROM true OR a.amount<=0 THEN RAISE EXCEPTION 'Supplier bank allocation mismatch'; END IF;
 IF a.supplier_invoice_id IS NOT NULL AND a.supplier_invoice_id<>i.id THEN RAISE EXCEPTION 'Allocation already belongs to another invoice'; END IF;
 IF (SELECT count(*) FROM public.journals WHERE source_event='supplier_payment_made' AND source_id=bt.id::text AND entity_id=p_entity_id AND is_posted)<>1 THEN RAISE EXCEPTION 'One authoritative posted bank payment required'; END IF;
 SELECT id INTO j FROM public.journals WHERE source_event='supplier_payment_made' AND source_id=bt.id::text AND entity_id=p_entity_id AND is_posted;
 UPDATE public.transaction_allocations SET supplier_invoice_id=i.id,payment_journal_id=j WHERE id=a.id;
 IF NOT public.maintenance_payment_evidence_valid(a.id) THEN RAISE EXCEPTION 'Verified statement, balanced bank posting and supplier ledger evidence required'; END IF;
 IF EXISTS(SELECT 1 FROM public.transaction_allocations WHERE supplier_invoice_id=i.id AND NOT public.maintenance_payment_evidence_valid(id)) THEN RAISE EXCEPTION 'Prior payment allocation requires reconciliation'; END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM public.transaction_allocations WHERE supplier_invoice_id=i.id;
 IF paid>i.total_amount THEN RAISE EXCEPTION 'Payment allocations exceed supplier invoice'; END IF;
 UPDATE public.supplier_invoices_new SET maintenance_paid_amount=paid WHERE id=i.id;
 IF a.supplier_invoice_id IS NULL THEN
  INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type,command_result)
  VALUES(i.maintenance_work_order_id,'payment_reconciled',i.invoice_number,auth.uid(),'user',jsonb_build_object('invoiceId',i.id,'allocationId',a.id,'paymentJournalId',j,'amount',a.amount));
 END IF;
 RETURN paid;
END;
$fn$;
REVOKE ALL ON FUNCTION public.reconcile_maintenance_supplier_payment(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_maintenance_supplier_payment(uuid,uuid,uuid) TO authenticated;
CREATE FUNCTION public.guard_maintenance_payment_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF current_user IN ('anon','authenticated') AND ((TG_OP<>'DELETE' AND NEW.supplier_invoice_id IS NOT NULL) OR (TG_OP<>'INSERT' AND OLD.supplier_invoice_id IS NOT NULL)) THEN RAISE EXCEPTION 'Use governed supplier payment reconciliation'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END;
$fn$;
CREATE TRIGGER maintenance_payment_allocations BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_allocations FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_payment_allocation();
REVOKE ALL ON FUNCTION public.guard_maintenance_payment_allocation() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.close_maintenance_work_order(p_entity_id uuid,p_work_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE w public.work_orders%ROWTYPE;i public.supplier_invoices_new%ROWTYPE;gross numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_entity_permission(auth.uid(),p_entity_id,'maintenance.work_order.certify'),false) THEN RAISE EXCEPTION 'Maintenance closure permission denied'; END IF;
 SELECT * INTO w FROM public.work_orders WHERE id=p_work_order_id AND entity_id=p_entity_id FOR UPDATE;
 IF NOT FOUND OR w.status NOT IN ('verified','closed') OR w.certified_by IS NULL THEN RAISE EXCEPTION 'Certified work order required'; END IF;
 FOR i IN SELECT * FROM public.supplier_invoices_new WHERE maintenance_work_order_id=w.id FOR SHARE LOOP
  IF i.lifecycle_status<>'posted' OR NOT public.maintenance_invoice_posting_consistent(i.id) OR NOT EXISTS(SELECT 1 FROM public.journals WHERE id=i.journal_id AND entity_id=p_entity_id AND is_posted AND source_id=i.id::text AND source_event='maintenance_supplier_invoice') OR
   (SELECT coalesce(sum(credit_amount-debit_amount),0) FROM public.sub_ledger_entries WHERE reference_id=i.id::text AND entity_id=p_entity_id AND supplier_id=i.supplier_id AND ledger_type='supplier') IS DISTINCT FROM i.total_amount THEN RAISE EXCEPTION 'Posted invoice and supplier ledger reconciliation required'; END IF;
  IF i.maintenance_paid_amount IS DISTINCT FROM i.total_amount OR (SELECT coalesce(sum(amount),0) FROM public.transaction_allocations WHERE supplier_invoice_id=i.id) IS DISTINCT FROM i.total_amount OR EXISTS(SELECT 1 FROM public.transaction_allocations WHERE supplier_invoice_id=i.id AND NOT public.maintenance_payment_evidence_valid(id)) THEN RAISE EXCEPTION 'Verified supplier payment reconciliation required before financial closure'; END IF;
  gross:=gross+i.total_amount;
 END LOOP;
 IF gross IS DISTINCT FROM w.actual_cost OR gross<=0 THEN RAISE EXCEPTION 'Supplier invoice allocations must equal certified cost before closure'; END IF;
 IF (SELECT count(*) FROM public.expected_supplier_invoices WHERE work_order_id=w.id AND entity_id=p_entity_id AND supplier_id=w.supplier_id AND expected_amount=w.actual_cost)<>1 THEN RAISE EXCEPTION 'Invoice expectation requires reconciliation'; END IF;
 IF w.status='closed' THEN RETURN to_jsonb(w); END IF;
 UPDATE public.expected_supplier_invoices SET status='matched' WHERE work_order_id=w.id AND entity_id=p_entity_id;
 UPDATE public.purchase_orders SET status='completed',completed_date=current_date WHERE id=w.purchase_order_id AND entity_id=p_entity_id;
 UPDATE public.work_orders SET status='closed',lifecycle_version=lifecycle_version+1,updated_at=now() WHERE id=w.id RETURNING * INTO w;
 INSERT INTO public.work_order_events(work_order_id,event_type,note,changed_by,changed_by_type) VALUES(w.id,'closed','Certified work, supplier invoice and verified bank payment reconciled',auth.uid(),'user');
 RETURN to_jsonb(w);
END;
$fn$;
CREATE FUNCTION public.list_maintenance_payment_allocations(p_entity_id uuid,p_invoice_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE i public.supplier_invoices_new%ROWTYPE;r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.has_entity_permission(auth.uid(),p_entity_id,'finance.supplier_payment.allocate'),false) THEN RAISE EXCEPTION 'Supplier payment allocation permission denied';END IF;
 SELECT * INTO i FROM public.supplier_invoices_new WHERE id=p_invoice_id AND entity_id=p_entity_id AND maintenance_work_order_id IS NOT NULL AND lifecycle_status='posted';
 IF NOT FOUND THEN RAISE EXCEPTION 'Posted maintenance invoice required';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'amount',a.amount,'transaction_date',t.transaction_date,'transaction_reference',t.transaction_reference) ORDER BY t.transaction_date,a.id),'[]'::jsonb) INTO r FROM public.transaction_allocations a JOIN public.bank_transactions t ON t.id=a.transaction_id JOIN public.bank_accounts b ON b.id=t.bank_account_id AND b.entity_id=p_entity_id
 WHERE a.supplier_id=i.supplier_id AND a.invoice_id IS NULL AND a.is_payment AND a.amount>0 AND t.transaction_amount<0 AND (a.supplier_invoice_id IS NULL OR a.supplier_invoice_id=i.id);
 RETURN r;
END;$fn$;
REVOKE ALL ON FUNCTION public.list_maintenance_payment_allocations(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.list_maintenance_payment_allocations(uuid,uuid) TO authenticated;
COMMIT;
