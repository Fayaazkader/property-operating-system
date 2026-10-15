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
 ${['properties','units','assets','tenants','leases','maintenance_issues','work_orders','work_order_events','property_timeline','maintenance_slas','permission_catalogue'].map(table).join('\n')}
 ALTER TABLE permission_catalogue ADD PRIMARY KEY(key);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261016020000_prepare_maintenance_work_order.sql','utf8'));
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
 const detached=randomUUID();await db.query("INSERT INTO work_orders(id,title) VALUES($1,'Standalone request')",[detached]);await assert.rejects(db.query('UPDATE work_orders SET issue_id=$1 WHERE id=$2',[ids.issue,detached]),/canonical issue/);
 const order=await prepare();await assert.rejects(db.query('DELETE FROM work_orders WHERE id=$1',[order.id]),/preserve its audit/);await assert.rejects(db.query('DELETE FROM work_order_events WHERE work_order_id=$1',[order.id]),/immutable/);
});
