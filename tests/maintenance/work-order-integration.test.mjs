import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadTypeScript} from '../execution/load-typescript.mjs';
const schema=readFileSync('supabase/migrations/20260826131729_remote_schema.sql','utf8');
const table=name=>schema.match(new RegExp(`CREATE TABLE "public"\\."${name}" \\([\\s\\S]*?\\n\\);`))[0];
let db,ids;
test.before(async()=>{
 db=new PGlite();await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE TABLE test_permissions(actor uuid,entity uuid,permission text);
 CREATE FUNCTION has_entity_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM public.test_permissions WHERE actor=$1 AND entity=$2 AND permission=$3)$$;
 ${['commission_type','broker_status'].map(name=>schema.match(new RegExp(`CREATE TYPE \"public\"\\.\"${name}\" AS ENUM \\([\\s\\S]*?\\);`))[0]).join('\n')}
 ${['properties','units','assets','tenants','leases','maintenance_issues','work_orders','work_order_events','property_timeline','maintenance_slas','permission_catalogue','maintenance_quotes','maintenance_approval_rules','suppliers','supplier_visits','expected_supplier_invoices','purchase_orders','documents','tax_config','supplier_invoices_new','supplier_invoice_lines','journals','journal_lines','general_ledger','sub_ledger_entries','financial_periods','financial_timeline','accounting_config','chart_of_accounts','brokers','bank_accounts','bank_statements','bank_transactions','transaction_allocations'].map(table).join('\n')}
 ALTER TABLE supplier_invoices_new ADD PRIMARY KEY(id);ALTER TABLE journals ADD PRIMARY KEY(id);ALTER TABLE bank_statements ADD COLUMN coverage_start date, ADD COLUMN coverage_end date, ADD COLUMN coverage_verified_at timestamptz, ADD COLUMN coverage_verified_by uuid;ALTER TABLE permission_catalogue ADD PRIMARY KEY(key);ALTER TABLE work_orders ADD PRIMARY KEY(id);ALTER TABLE maintenance_quotes ADD PRIMARY KEY(id);ALTER TABLE documents ADD PRIMARY KEY(id);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261016020000_prepare_maintenance_work_order.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261016050000_govern_maintenance_lifecycle.sql','utf8'));
 await db.exec('ALTER TABLE journal_lines ADD COLUMN bank_account_id uuid');
 const primitive=readFileSync('supabase/migrations/20260916120000_add_bank_account_dimension_to_journal_lines.sql','utf8').match(/CREATE OR REPLACE FUNCTION public.atomic_post_journal[\s\S]*?\$function\$;/)[0].replace('public.atomic_post_journal(','public.atomic_post_journal_internal(');
 await db.exec(primitive);
 await db.exec(readFileSync('supabase/migrations/20261016000000_atomic_commencement_invoice.sql','utf8').match(/CREATE FUNCTION public.post_journal_tenant_ledger[\s\S]*?\$function\$;/)[0]);
 await db.exec(readFileSync('supabase/migrations/20261016010000_govern_financial_posting.sql','utf8').split('CREATE FUNCTION public.invoice_requires_governed_command')[0]+'COMMIT;');
 await db.exec('CREATE POLICY fixture_supplier_read ON sub_ledger_entries FOR SELECT TO authenticated USING(true);CREATE POLICY fixture_supplier_write ON sub_ledger_entries FOR ALL TO authenticated USING(true) WITH CHECK(true)');
 await db.exec(readFileSync('supabase/migrations/20261016060000_maintenance_invoice_accounting.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261016070000_maintenance_payment_reconciliation.sql','utf8'));

 // Simulate broad legacy policies: the restrictive scope and command guards must still hold.
 for(const table of ['work_orders','maintenance_quotes','work_order_events','supplier_visits','expected_supplier_invoices','supplier_invoices_new','supplier_invoice_lines'])await db.exec(`CREATE POLICY legacy_fixture_crud ON ${table} FOR ALL TO authenticated USING(true) WITH CHECK(true)`);
});
test.beforeEach(async()=>{
 ids=Object.fromEntries(['actor','otherActor','entity','otherEntity','property','otherProperty','issue','unit'].map(k=>[k,randomUUID()]));await db.exec('RESET ROLE');
 await db.query("SELECT set_config('test.actor',$1,false)",[ids.actor]);await db.query("INSERT INTO test_permissions VALUES($1,$2,'maintenance.work_order.create')",[ids.actor,ids.entity]);
 await db.query("INSERT INTO properties(id,property_name,entity_id) VALUES($1,'Canonical Property',$2),($3,'Foreign Property',$4)",[ids.property,ids.entity,ids.otherProperty,ids.otherEntity]);
 await db.query("INSERT INTO units(id,property_id,unit_number) VALUES($1,$2,'A1')",[ids.unit,ids.property]);
 await db.query("INSERT INTO maintenance_issues(id,entity_id,property_id,unit_id,title,description,priority,reported_via,created_at) VALUES($1,$2,$3,$4,'Burst pipe','Photographs attached','emergency','whatsapp',now()-interval '2 hours')",[ids.issue,ids.entity,ids.property,ids.unit]);
 await db.query("INSERT INTO maintenance_slas(entity_id,priority,response_hours,arrival_hours,resolution_hours) VALUES($1,'emergency',1,2,4)",[ids.entity]);await db.exec('SET ROLE authenticated');
});
test.after(async()=>{await db.close();});
async function prepare(entity=ids.entity,property=ids.property){return (await db.query('SELECT prepare_maintenance_work_order($1,$2,$3) result',[entity,ids.issue,property])).rows[0].result;}
test('issue creates one canonical reported work order with durable actor, timeline and original SLA origin',async()=>{
 const order=await prepare();const retry=await prepare();assert.equal(order.id,retry.id);assert.equal(order.status,'reported');assert.equal(order.created_by,ids.actor);assert.equal(order.unit_id,ids.unit);assert.equal(order.priority,'emergency');assert.equal(order.sla_breached,true);assert.equal(order.timeline.length,1);
 assert.equal(new Date(order.sla_completed_at)-new Date(order.sla_response_at),3*3600000);assert.equal(order.assigned_to,null);assert.equal(order.estimated_cost,null);
 const issue=(await db.query('SELECT status FROM maintenance_issues WHERE id=$1',[ids.issue])).rows[0];assert.equal(issue.status,'reported');assert.equal((await db.query('SELECT count(*)::int n FROM property_timeline WHERE reference_id=$1',[order.id])).rows[0].n,1);
});
test('preparation denies foreign actor, entity, property and unit',async()=>{
 await assert.rejects(prepare(ids.otherEntity),/permission denied/);await assert.rejects(prepare(ids.entity,ids.otherProperty),/scope mismatch/);
 await db.query("SELECT set_config('test.actor',$1,false)",[ids.otherActor]);await assert.rejects(prepare(),/permission denied/);await db.query("SELECT set_config('test.actor',$1,false)",[ids.actor]);
 await db.exec('RESET ROLE');await db.query('UPDATE units SET property_id=$1 WHERE id=$2',[ids.otherProperty,ids.unit]);await db.exec('SET ROLE authenticated');await assert.rejects(prepare(),/unit scope/);
});
test('missing or ambiguous SLA does not invent a deadline or create a work order',async()=>{
 await db.query('DELETE FROM maintenance_slas WHERE entity_id=$1',[ids.entity]);await assert.rejects(prepare(),/configured entity maintenance SLA/);assert.equal((await db.query('SELECT count(*)::int n FROM work_orders WHERE issue_id=$1',[ids.issue])).rows[0].n,0);
});
test('audit failure rolls preparation back; retry creates exactly one work order',async()=>{
 await db.exec('RESET ROLE');await db.exec("CREATE FUNCTION reject_wo_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Maintenance audit outage';END$$;CREATE TRIGGER reject_wo_audit BEFORE INSERT ON property_timeline FOR EACH ROW EXECUTE FUNCTION reject_wo_audit()");await db.exec('SET ROLE authenticated');
 await assert.rejects(prepare(),/audit outage/);assert.equal((await db.query('SELECT count(*)::int n FROM work_orders WHERE issue_id=$1',[ids.issue])).rows[0].n,0);
 await db.exec('RESET ROLE;DROP TRIGGER reject_wo_audit ON property_timeline;DROP FUNCTION reject_wo_audit();SET ROLE authenticated');assert.ok((await prepare()).id);
});
test('terminal or duplicate issues cannot prepare new work',async()=>{
 await db.query("UPDATE maintenance_issues SET status='closed' WHERE id=$1",[ids.issue]);await assert.rejects(prepare(),/not eligible/);
 await db.query("UPDATE maintenance_issues SET status='reported',duplicate_of=$1 WHERE id=$2",[randomUUID(),ids.issue]);await assert.rejects(prepare(),/not eligible/);
});
test('browser CRUD cannot bypass preparation or rebind the canonical context',async()=>{
 await assert.rejects(db.query("INSERT INTO work_orders(issue_id,title) VALUES($1,'Bypass')",[ids.issue]),/canonical issue/);const order=await prepare();await assert.rejects(db.query('UPDATE work_orders SET property_id=$1 WHERE id=$2',[ids.otherProperty,order.id]),/immutable/);
});
test('both maintenance and property service entry points use the same real transaction and records',async()=>{
 const client={async rpc(name,args){try{return {data:(await db.query(`SELECT ${name}(p_entity_id=>$1,p_issue_id=>$2,p_property_id=>$3) result`,[args.p_entity_id,args.p_issue_id,args.p_property_id])).rows[0].result};}catch(error){return {error};}}};
 const overrides={'@/lib/supabase':{supabase:client},'@/lib/platform/events':{publish:async()=>{}},'@/lib/platform/policies/sla.engine':{slaEngine:{}},'@/lib/platform/events/event-bus':{publish:async()=>{}},'./supplier-matching':{supplierMatchingEngine:{}}};
 const cache=new Map();const {workOrderService}=loadTypeScript('lib/property-operations/services/work-order.service.ts',overrides,cache);
 const {MaintenanceEngine}=loadTypeScript('lib/maintenance/engine.ts',overrides,cache);const order=await new MaintenanceEngine().createWorkOrder(ids.issue,ids.entity,ids.property);const repeated=await workOrderService.prepareFromIssue(ids.issue,ids.entity,ids.property);
 assert.equal(order.id,repeated.data.id);assert.equal((await db.query('SELECT count(*)::int n FROM work_order_events WHERE work_order_id=$1',[order.id])).rows[0].n,1);
});

test('canonical asset mapping is retained and foreign asset cannot be substituted',async()=>{
 const asset=randomUUID();await db.exec('RESET ROLE');await db.query("INSERT INTO assets(id,entity_id,property_id,name,type) VALUES($1,$2,$3,'Pump','equipment')",[asset,ids.entity,ids.property]);await db.query('UPDATE maintenance_issues SET asset_id=$1 WHERE id=$2',[asset,ids.issue]);await db.exec('SET ROLE authenticated');const order=await prepare();assert.equal(order.asset_id,asset);
 await assert.rejects(db.query('UPDATE work_orders SET asset_id=$1 WHERE id=$2',[randomUUID(),order.id]),/immutable/);
});

test('detached orders cannot be rebound around the command and prepared audit cannot be deleted',async()=>{
 const detached=randomUUID();await db.query("INSERT INTO work_orders(id,entity_id,title) VALUES($1,$2,'Standalone request')",[detached,ids.entity]);await assert.rejects(db.query('UPDATE work_orders SET issue_id=$1 WHERE id=$2',[ids.issue,detached]),/canonical issue/);
 const order=await prepare();await assert.rejects(db.query('DELETE FROM work_orders WHERE id=$1',[order.id]),/preserve its audit/);await assert.rejects(db.query('DELETE FROM work_order_events WHERE work_order_id=$1',[order.id]),/immutable/);
});

async function lifecycleFixture(){
 const order=await prepare();const actor=ids.actor,approver=randomUUID(),supplier=randomUUID(),document=randomUUID();await db.exec('RESET ROLE');
 for(const person of [actor,approver])for(const permission of ['maintenance.work_order.manage','maintenance.work_order.approve','maintenance.work_order.authorize','maintenance.work_order.certify'])await db.query('INSERT INTO test_permissions VALUES($1,$2,$3)',[person,ids.entity,permission]);
 await db.query("INSERT INTO suppliers(id,entity_id,supplier_name) VALUES($1,$2,'Contractor')",[supplier,ids.entity]);
 await db.query("INSERT INTO documents(id,entity_id,file_name,mime_type,storage_key,checksum,requires_review) VALUES($1,$2,'Evidence.pdf','application/pdf','private/evidence',$3,false)",[document,ids.entity,'a'.repeat(64)]);
 await db.query("INSERT INTO tax_config(entity_id,tax_code,tax_name,tax_rate) VALUES($1,'VAT_STANDARD','Configured VAT',12)",[ids.entity]);
 await db.query("INSERT INTO maintenance_approval_rules(entity_id,rule_name,condition_field,condition_operator,condition_value,approval_level,required_permission) VALUES($1,'Explicit mandate','amount','<=','1000','Configured authority','maintenance.work_order.approve')",[ids.entity]);await db.exec('SET ROLE authenticated');
 return {order,actor,approver,supplier,document};
}
async function command(f,action,payload={},request=randomUUID(),version=f.order.lifecycle_version){const result=(await db.query('SELECT command_maintenance_work_order($1,$2,$3,$4,$5,$6) result',[ids.entity,f.order.id,request,version,action,JSON.stringify({note:'Reviewed operational evidence',...payload})])).rows[0].result;f.order=result.workOrder;return result;}
async function quote(f){return command(f,'quote',{supplier_id:f.supplier,document_id:f.document,amount_excl_vat:100,tax_code:'VAT_STANDARD'});}
async function actor(id){await db.query("SELECT set_config('test.actor',$1,false)",[id]);}
async function authorize(f){const q=await quote(f);await actor(f.approver);await command(f,'approve',{quote_id:q.recordId});await command(f,'authorize');await actor(f.actor);return f;}
async function complete(f){await authorize(f);await command(f,'accept',{document_id:f.document});await command(f,'schedule',{scheduled_at:new Date(Date.now()+3600000).toISOString()});await command(f,'start');await command(f,'progress',{document_id:f.document});await command(f,'complete',{document_id:f.document,actual_cost:112});return f;}

test('quote approval authorization execution and independent certification use canonical records and configured VAT',async()=>{
 const f=await lifecycleFixture();await complete(f);assert.equal(f.order.status,'completed');await actor(f.approver);const key=randomUUID(),version=f.order.lifecycle_version;const first=await command(f,'certify',{document_id:f.document},key,version);assert.equal(f.order.status,'verified');assert.equal(Number(f.order.actual_cost),112);assert.deepEqual(await command(f,'certify',{document_id:f.document},key,version),first);
 const expected=(await db.query('SELECT * FROM expected_supplier_invoices WHERE work_order_id=$1',[f.order.id])).rows;assert.equal(expected.length,1);assert.equal(Number(expected[0].expected_amount),112);assert.equal(expected[0].supplier_id,f.supplier);
 assert.equal((await db.query('SELECT count(*)::int n FROM purchase_orders WHERE work_order_id=$1',[f.order.id])).rows[0].n,1);
 const events=(await db.query('SELECT * FROM work_order_events WHERE work_order_id=$1 ORDER BY created_at',[f.order.id])).rows;assert.equal(events.length,10);assert.equal(events.find(e=>e.event_type==='approve').command_result.authority[0].condition_value,'1000');assert.equal(events.at(-1).changed_by,f.approver);
});
test('approval denies self-approval, missing authority, over-limit gross and foreign contractor',async()=>{
 const f=await lifecycleFixture();await assert.rejects(command(f,'quote',{supplier_id:randomUUID(),document_id:f.document,amount_excl_vat:100,tax_code:'VAT_STANDARD'}),/contractor/);const q=await quote(f);await assert.rejects(command(f,'approve',{quote_id:q.recordId}),/separation/);await actor(f.approver);await db.exec('RESET ROLE');await db.query("UPDATE maintenance_approval_rules SET condition_value='100' WHERE entity_id=$1",[ids.entity]);await db.exec('SET ROLE authenticated');await assert.rejects(command(f,'approve',{quote_id:q.recordId}),/covers gross/);await db.exec('RESET ROLE');await db.query("UPDATE maintenance_approval_rules SET required_permission=NULL WHERE entity_id=$1",[ids.entity]);await db.exec('SET ROLE authenticated');await assert.rejects(command(f,'approve',{quote_id:q.recordId}),/Configure explicit/);
});
test('stale and modified replay fail without creating another quote; exact replay recovers',async()=>{
 const f=await lifecycleFixture();const key=randomUUID(),payload={supplier_id:f.supplier,document_id:f.document,amount_excl_vat:100,tax_code:'VAT_STANDARD'};const result=await command(f,'quote',payload,key,0);assert.deepEqual(await command(f,'quote',payload,key,0),result);await assert.rejects(command(f,'quote',{...payload,amount_excl_vat:200},key,0),/replay differs/);await assert.rejects(command(f,'quote',payload,randomUUID(),0),/Stale/);assert.equal((await db.query('SELECT count(*)::int n FROM maintenance_quotes WHERE work_order_id=$1',[f.order.id])).rows[0].n,1);
});
test('direct CRUD cannot approve, assign, fabricate evidence or alter purchase order',async()=>{
 const f=await lifecycleFixture();await authorize(f);for(const sql of ["UPDATE work_orders SET status='closed' WHERE id=$1","UPDATE purchase_orders SET amount=1 WHERE work_order_id=$1","INSERT INTO supplier_visits(work_order_id) VALUES($1)","INSERT INTO work_order_events(work_order_id,event_type) VALUES($1,'certify')","INSERT INTO expected_supplier_invoices(work_order_id) VALUES($1)"])await assert.rejects(db.query(sql,[f.order.id]),/governed maintenance/);
});
test('completion requires progress and certification rejects self-certification and changed evidence',async()=>{
 const f=await lifecycleFixture();await authorize(f);await command(f,'accept',{document_id:f.document});await command(f,'schedule',{scheduled_at:new Date(Date.now()+3600000).toISOString()});await command(f,'start');await assert.rejects(command(f,'complete',{document_id:f.document,actual_cost:112}),/Progress evidence/);await command(f,'progress',{document_id:f.document});await assert.rejects(command(f,'complete',{document_id:f.document,actual_cost:113}),/approved authority/);await command(f,'complete',{document_id:f.document,actual_cost:112});await assert.rejects(command(f,'certify',{document_id:f.document}),/Independent/);await actor(f.approver);await db.exec('RESET ROLE');await db.query('UPDATE documents SET checksum=$1 WHERE id=$2',['b'.repeat(64),f.document]);await db.exec('SET ROLE authenticated');await assert.rejects(command(f,'certify',{document_id:f.document}),/integrity changed/);
});
test('audit failure rolls approval and version back and the same request safely recovers',async()=>{
 const f=await lifecycleFixture();const q=await quote(f);await actor(f.approver);await db.exec('RESET ROLE');await db.exec("CREATE FUNCTION reject_command_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Maintenance audit outage';END$$;CREATE TRIGGER reject_command_audit BEFORE INSERT ON property_timeline FOR EACH ROW EXECUTE FUNCTION reject_command_audit()");await db.exec('SET ROLE authenticated');const key=randomUUID();await assert.rejects(command(f,'approve',{quote_id:q.recordId},key),/audit outage/);assert.equal((await db.query('SELECT status FROM maintenance_quotes WHERE id=$1',[q.recordId])).rows[0].status,'received');await db.exec('RESET ROLE;DROP TRIGGER reject_command_audit ON property_timeline;DROP FUNCTION reject_command_audit();SET ROLE authenticated');await command(f,'approve',{quote_id:q.recordId},key);assert.equal(f.order.status,'approved');
});
test('rescheduling preserves cancelled visit history and rejected completion resumes work',async()=>{
 const f=await lifecycleFixture();await complete(f);await command(f,'reject_completion');assert.equal(f.order.status,'in_progress');await command(f,'complete',{document_id:f.document,actual_cost:100});assert.equal(Number(f.order.actual_cost),100);
});

test('read policies deny another entity even with broad legacy policies',async()=>{
 const f=await lifecycleFixture();await quote(f);await actor(ids.otherActor);for(const table of ['work_orders','maintenance_quotes','work_order_events'])assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0);await assert.rejects(command(f,'cancel'),/permission denied/);
});
test('two competing commands at one version produce one committed transition',async()=>{
 const f=await lifecycleFixture();const results=await Promise.allSettled([quote(f),quote(f)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await db.query('SELECT count(*)::int n FROM maintenance_quotes WHERE work_order_id=$1',[f.order.id])).rows[0].n,1);
});
test('actual WorkOrderService submits and recovers the same canonical quotation transaction',async()=>{
 const f=await lifecycleFixture();const client={async rpc(name,args){try{return {data:(await db.query(`SELECT ${name}($1,$2,$3,$4,$5,$6) result`,[args.p_entity_id,args.p_work_order_id,args.p_request_id,args.p_expected_version,args.p_action,JSON.stringify(args.p_payload)])).rows[0].result};}catch(error){return {error};}}};
 const {workOrderService}=loadTypeScript('lib/property-operations/services/work-order.service.ts',{'@/lib/supabase':{supabase:client},'@/lib/platform/events':{publish:async()=>{}},'@/lib/platform/policies/sla.engine':{slaEngine:{}}});const input={entityId:ids.entity,workOrderId:f.order.id,requestId:randomUUID(),expectedVersion:0,action:'quote',payload:{note:'Contractor quotation',supplier_id:f.supplier,document_id:f.document,amount_excl_vat:100,tax_code:'VAT_STANDARD'}};
 const first=await workOrderService.commandLifecycle(input);assert.deepEqual(await workOrderService.commandLifecycle(input),first);assert.equal(first.workOrder.status,'quoted');
});

async function accountingFixture(){
 const f=await lifecycleFixture();await complete(f);await actor(f.approver);await command(f,'certify',{document_id:f.document});await db.exec('RESET ROLE');
 for(const person of [f.actor,f.approver])for(const permission of ['invoices.capture','invoices.approve','invoices.post','finance.journal.post','finance.supplier_payment.allocate'])await db.query('INSERT INTO test_permissions VALUES($1,$2,$3)',[person,ids.entity,permission]);
 const accounts={};for(const [role,type] of [['maintenance_cost','expense'],['ap_control','liability'],['vat_input','asset']]){const id=randomUUID();accounts[role]=id;await db.query('INSERT INTO chart_of_accounts(id,entity_id,gl_code,account_name,account_type,category) VALUES($1,$2,$3,$3,$4,$3)',[id,ids.entity,role,type]);await db.query('INSERT INTO accounting_config(entity_id,business_role,account_id) VALUES($1,$2,$3)',[ids.entity,role,id]);}
 const date=new Date().toISOString().slice(0,10);const period=randomUUID();await db.query("INSERT INTO financial_periods(id,entity_id,period_name,period_start,period_end,period_type,status) VALUES($1,$2,'Test accounting',$3::date,$3::date,'financial','open')",[period,ids.entity,date]);
 await db.exec('SET ROLE authenticated');await actor(f.actor);return {...f,accounts,period,input:{invoiceNumber:'INV-'+randomUUID(),invoiceDate:date,dueDate:date,description:'Certified repairs',documentId:f.document,lines:[{propertyId:ids.property,glCode:'maintenance_cost',description:'Labour',amount:60,vatCode:'VAT_STANDARD'},{propertyId:ids.property,glCode:'maintenance_cost',description:'Materials',amount:40,vatCode:'VAT_STANDARD'}]}};
}
async function captureInvoice(f,input=f.input){return (await db.query('SELECT capture_maintenance_supplier_invoice($1,$2,$3) result',[ids.entity,f.order.id,JSON.stringify(input)])).rows[0].result;}
async function postInvoice(i){return (await db.query('SELECT post_maintenance_supplier_invoice($1,$2) id',[ids.entity,i.id])).rows[0].id;}
async function approveInvoice(f,i){await actor(f.approver);await db.query('SELECT approve_maintenance_supplier_invoice($1,$2)',[ids.entity,i.id]);}
async function closeOrder(f){return (await db.query('SELECT close_maintenance_work_order($1,$2) result',[ids.entity,f.order.id])).rows[0].result;}
test('complete maintenance lifecycle posts multiline costs VAT AP ledger and closes only after financial reconciliation',async()=>{
 const f=await accountingFixture();const invoice=await captureInvoice(f);assert.equal((await captureInvoice(f)).id,invoice.id);await assert.rejects(postInvoice(invoice),/Approved invoice/);await assert.rejects(db.query('SELECT approve_maintenance_supplier_invoice($1,$2)',[ids.entity,invoice.id]),/Independent/);await approveInvoice(f,invoice);const journal=await postInvoice(invoice);assert.equal(await postInvoice(invoice),journal);
 const lines=(await db.query('SELECT account_id,debit_amount,credit_amount FROM journal_lines WHERE journal_id=$1',[journal])).rows;assert.equal(lines.length,4);assert.equal(lines.reduce((n,l)=>n+Number(l.debit_amount)-Number(l.credit_amount),0),0);
 const ledger=(await db.query("SELECT * FROM sub_ledger_entries WHERE supplier_id=$1 AND ledger_type='supplier'",[f.supplier])).rows;assert.equal(ledger.length,1);assert.equal(Number(ledger[0].credit_amount),112);assert.equal(Number(ledger[0].running_balance),-112);await assert.rejects(closeOrder(f),/payment reconciliation/);const payment=await paymentFixture(f);await reconcilePayment(invoice,payment);await reconcilePayment(invoice,payment);assert.equal((await closeOrder(f)).status,'closed');assert.equal((await closeOrder(f)).status,'closed');
});
test('capture rejects different duplicate values foreign allocation and overrun without partial lines',async()=>{
 const f=await accountingFixture();await assert.rejects(captureInvoice(f,{...f.input,lines:f.input.lines.map(l=>({...l,propertyId:ids.otherProperty}))}),/property mismatch/);await assert.rejects(captureInvoice(f,{...f.input,lines:f.input.lines.map(l=>({...l,amount:100}))}),/exceed certified/);const i=await captureInvoice(f);await assert.rejects(captureInvoice(f,{...f.input,description:'Changed'}),/changed replay/);assert.equal((await db.query('SELECT count(*)::int n FROM supplier_invoice_lines WHERE invoice_id=$1',[i.id])).rows[0].n,2);
});
test('posting respects closed periods and recovers a prior exact posting after closure',async()=>{
 const f=await accountingFixture();const i=await captureInvoice(f);await approveInvoice(f,i);await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE id=$1",[f.period]);await db.exec('SET ROLE authenticated');await assert.rejects(postInvoice(i),/Open accounting/);await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='open',workflow_phase='open' WHERE id=$1",[f.period]);await db.exec('SET ROLE authenticated');const journal=await postInvoice(i);await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE id=$1",[f.period]);await db.exec('SET ROLE authenticated');assert.equal(await postInvoice(i),journal);
});
test('financial audit failure rolls back invoice journal GL and supplier ledger; retry succeeds',async()=>{
 const f=await accountingFixture();const i=await captureInvoice(f);await approveInvoice(f,i);await db.exec('RESET ROLE');await db.exec("CREATE FUNCTION reject_ap_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'AP audit unavailable';END$$;CREATE TRIGGER reject_ap_audit BEFORE INSERT ON financial_timeline FOR EACH ROW EXECUTE FUNCTION reject_ap_audit()");await db.exec('SET ROLE authenticated');await assert.rejects(postInvoice(i),/AP audit unavailable/);assert.equal((await db.query('SELECT count(*)::int n FROM journals WHERE source_id=$1',[i.id])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM sub_ledger_entries WHERE reference_id=$1',[i.id])).rows[0].n,0);assert.equal((await db.query('SELECT lifecycle_status FROM supplier_invoices_new WHERE id=$1',[i.id])).rows[0].lifecycle_status,'approved');await db.exec('RESET ROLE;DROP TRIGGER reject_ap_audit ON financial_timeline;DROP FUNCTION reject_ap_audit();SET ROLE authenticated');assert.ok(await postInvoice(i));
});
test('missing GL evidence prevents replay and closure; browser cannot alter approved invoice allocation',async()=>{
 const f=await accountingFixture();const i=await captureInvoice(f);await approveInvoice(f,i);const j=await postInvoice(i);await assert.rejects(db.query('UPDATE supplier_invoice_lines SET amount=1 WHERE invoice_id=$1',[i.id]),/immutable/);await assert.rejects(db.query("UPDATE supplier_invoices_new SET lifecycle_status='posted' WHERE id=$1",[i.id]),/governed/);await db.exec('RESET ROLE');await db.query('DELETE FROM general_ledger WHERE journal_line_id IN (SELECT id FROM journal_lines WHERE journal_id=$1)',[j]);await db.exec('SET ROLE authenticated');await assert.rejects(postInvoice(i),/reconciliation/);await assert.rejects(closeOrder(f),/reconciliation/);
});
test('generic posting cannot forge reserved maintenance accounting source',async()=>{await assert.rejects(db.query("SELECT atomic_post_journal('{\"source_event\":\"maintenance_supplier_invoice\"}','[]')"),/governed invoice/);});

async function paymentFixture(f,amount=112){
 const bank=randomUUID(),statement=randomUUID(),transaction=randomUUID(),allocation=randomUUID(),cash=randomUUID();
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO bank_accounts(id,entity_id,bank_name,account_name,account_number) VALUES($1,$2,'Fixture','Operating','TEST')",[bank,ids.entity]);
 await db.query("INSERT INTO bank_statements(id,bank_account_id,entity_id,statement_date,coverage_start,coverage_end,coverage_verified_at,coverage_verified_by) VALUES($1,$2,$3,$4,$4,$4,now(),$5)",[statement,bank,ids.entity,f.input.invoiceDate,f.approver]);
 await db.query('INSERT INTO bank_transactions(id,bank_account_id,statement_id,transaction_date,transaction_amount) VALUES($1,$2,$3,$4,$5)',[transaction,bank,statement,f.input.invoiceDate,-amount]);
 await db.query("INSERT INTO transaction_allocations(id,transaction_id,type,supplier_id,amount,is_payment) VALUES($1,$2,'supplier',$3,$4,true)",[allocation,transaction,f.supplier,amount]);
 await db.query("INSERT INTO chart_of_accounts(id,entity_id,gl_code,account_name,account_type,category) VALUES($1,$2,$3,'Bank','asset','bank')",[cash,ids.entity,'bank-'+bank]);
 await db.exec('SET ROLE authenticated');
 const journal={id:randomUUID(),journal_number:'PAY-'+transaction,journal_type:'payment',entity_id:ids.entity,period_id:f.period,source_event:'supplier_payment_made',source_id:transaction,journal_date:f.input.invoiceDate,description:'Verified payment',created_by:f.approver};
 const lines=[{account_id:f.accounts.ap_control,debit_amount:amount,credit_amount:0,supplier_id:f.supplier},{account_id:cash,debit_amount:0,credit_amount:amount,bank_account_id:bank}].map(l=>({...l,id:randomUUID(),entity_id:ids.entity,description:'Supplier payment'}));
 await db.query('SELECT atomic_post_journal($1,$2)',[JSON.stringify(journal),JSON.stringify(lines)]);
 return {allocation,statement,transaction};
}
async function reconcilePayment(invoice,payment){return (await db.query('SELECT reconcile_maintenance_supplier_payment($1,$2,$3) paid',[ids.entity,invoice.id,payment.allocation])).rows[0].paid;}
test('payment requires verified same-entity statement and cannot overpay or bypass allocation governance',async()=>{
 const f=await accountingFixture(),i=await captureInvoice(f);await approveInvoice(f,i);await postInvoice(i);const p=await paymentFixture(f);
 await db.exec('RESET ROLE');await db.query('UPDATE bank_statements SET coverage_verified_at=NULL WHERE id=$1',[p.statement]);await db.exec('SET ROLE authenticated');await assert.rejects(reconcilePayment(i,p),/Verified statement/);
 await db.exec('RESET ROLE');await db.query('UPDATE bank_statements SET coverage_verified_at=now(),entity_id=$1 WHERE id=$2',[ids.otherEntity,p.statement]);await db.exec('SET ROLE authenticated');await assert.rejects(reconcilePayment(i,p),/Verified statement/);
 await db.exec('RESET ROLE');await db.query('UPDATE bank_statements SET entity_id=$1 WHERE id=$2',[ids.entity,p.statement]);await db.exec('SET ROLE authenticated');assert.equal(Number(await reconcilePayment(i,p)),112);
 await assert.rejects(db.query('DELETE FROM transaction_allocations WHERE id=$1',[p.allocation]),/governed/);
 const excess=await paymentFixture(f,1);await assert.rejects(reconcilePayment(i,excess),/exceed/);await actor(ids.otherActor);await assert.rejects(reconcilePayment(i,p),/permission denied/);
});
test('partial payments keep work financially open and payment audit outage rolls binding back',async()=>{
 const f=await accountingFixture(),i=await captureInvoice(f);await approveInvoice(f,i);await postInvoice(i);const first=await paymentFixture(f,50);await reconcilePayment(i,first);await assert.rejects(closeOrder(f),/payment reconciliation/);const last=await paymentFixture(f,62);
 await db.exec("RESET ROLE;CREATE FUNCTION fail_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.event_type='payment_reconciled' THEN RAISE EXCEPTION 'Payment audit outage';END IF;RETURN NEW;END$$;CREATE TRIGGER fail_payment_audit BEFORE INSERT ON work_order_events FOR EACH ROW EXECUTE FUNCTION fail_payment_audit();SET ROLE authenticated");
 await assert.rejects(reconcilePayment(i,last),/Payment audit outage/);assert.equal((await db.query('SELECT supplier_invoice_id FROM transaction_allocations WHERE id=$1',[last.allocation])).rows[0].supplier_invoice_id,null);
 await db.exec('RESET ROLE;DROP TRIGGER fail_payment_audit ON work_order_events;DROP FUNCTION fail_payment_audit();SET ROLE authenticated');assert.equal(Number(await reconcilePayment(i,last)),112);assert.equal((await closeOrder(f)).status,'closed');
});
test('actual AP service captures approves posts lists and reconciles canonical maintenance accounting',async()=>{
 const f=await accountingFixture();const signatures={capture_maintenance_supplier_invoice:['p_entity_id','p_work_order_id','p_input'],approve_maintenance_supplier_invoice:['p_entity_id','p_invoice_id'],post_maintenance_supplier_invoice:['p_entity_id','p_invoice_id'],list_maintenance_payment_allocations:['p_entity_id','p_invoice_id'],reconcile_maintenance_supplier_payment:['p_entity_id','p_invoice_id','p_allocation_id']};
 const client={async rpc(name,args){assert.ok(signatures[name]);try{return {data:(await db.query(`SELECT ${name}(${signatures[name].map((_,i)=>'$'+(i+1)).join(',')}) result`,signatures[name].map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]))).rows[0].result};}catch(error){return {error};}},from(table){assert.equal(table,'supplier_invoices_new');const filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},async single(){return {data:(await db.query('SELECT maintenance_work_order_id FROM supplier_invoices_new WHERE id=$1 AND entity_id=$2',[filters.id,filters.entity_id])).rows[0]};}};}};
 const {apApi}=loadTypeScript('lib/accounts-payable/api.ts',{'@/lib/supabase':{supabase:client},'@/lib/financial/posting-engine':{PostingEngine:{}},'@/lib/platform/events/event-bus':{publish:async()=>{throw new Error('Unexpected nontransactional side effect');}}});
 const input={...f.input,entityId:ids.entity,workOrderId:f.order.id,supplierId:f.supplier};const i=await apApi.captureInvoice(input);assert.equal((await apApi.captureInvoice(input)).id,i.id);await actor(f.approver);await apApi.approveInvoice(i.id,'untrusted-actor',ids.entity);await apApi.postInvoice(i.id,'untrusted-actor',ids.entity);const payment=await paymentFixture(f);assert.equal((await apApi.listMaintenancePaymentAllocations(ids.entity,i.id))[0].id,payment.allocation);assert.equal(await apApi.reconcileMaintenancePayment(ids.entity,i.id,payment.allocation),112);assert.equal((await closeOrder(f)).status,'closed');
 await assert.rejects(db.query("UPDATE sub_ledger_entries SET credit_amount=0 WHERE supplier_id=$1",[f.supplier]),/atomic supplier/);await actor(ids.otherActor);assert.equal((await db.query('SELECT * FROM supplier_invoices_new WHERE id=$1',[i.id])).rows.length,0);assert.equal((await db.query('SELECT * FROM supplier_invoice_lines WHERE invoice_id=$1',[i.id])).rows.length,0);await assert.rejects(apApi.listMaintenancePaymentAllocations(ids.entity,i.id),/permission denied/);
});
