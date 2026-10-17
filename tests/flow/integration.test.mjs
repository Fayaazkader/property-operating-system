import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadTypeScript} from '../execution/load-typescript.mjs';
const read=n=>readFileSync(`supabase/migrations/${n}.sql`,'utf8');
const schema=read('20260826131729_remote_schema');
const table=n=>schema.match(new RegExp(`CREATE TABLE "public"\\."${n}" \\([\\s\\S]*?\\n\\);`))[0];
let deliverImpl=()=>{throw Error('No external delivery in fixture');};
const {statementManifest,approveStatements}=loadTypeScript('lib/flow/statements.ts',{'@/lib/communications/services/delivery-service':{deliver:(...args)=>deliverImpl(...args)}});
let db,actor,entity,property,tenant,period;
async function rpc(name,args){return (await db.query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS result`,args)).rows[0].result;}
async function owner(){await db.exec('RESET ROLE');}
async function user(){await db.exec('SET ROLE authenticated');}
async function prepare(key=randomUUID(),query='Fixture Tenant Fixture Property',scope={}){return rpc('prepare_flow_statements',[key,'Send Fixture Tenant Fixture Property their last one month of statements',query,1,scope.entity??null,scope.property??null,scope.tenant??null]);}
async function stage(){const a=await prepare();assert.equal(a.status,'preparing',a.reason);const m=await statementManifest(a.snapshot);await owner();await db.exec('SET ROLE service_role');const r=await rpc('stage_flow_statement',[a.id,a.snapshot,m]);await user();return r;}
async function claim(a){return rpc('claim_flow_statement',[a.id,a.manifest_hash]);}
test.before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth,public TO authenticated,service_role,anon;
 ${['commission_type','broker_status'].map(n=>schema.match(new RegExp(`CREATE TYPE "public"\\."${n}" AS ENUM \\([\\s\\S]*?\\);`))[0]).join('\n')}
 ${['entities','properties','tenants','leases','user_entity_access','permission_catalogue','financial_periods','statements_generated','communication_preferences','tenant_communication_prefs','communications_queue','financial_timeline'].map(table).join('\n')}
 ALTER TABLE entities ADD PRIMARY KEY(id);ALTER TABLE properties ADD PRIMARY KEY(id);ALTER TABLE tenants ADD PRIMARY KEY(id);ALTER TABLE communications_queue ADD PRIMARY KEY(id);
 ALTER TABLE permission_catalogue ADD PRIMARY KEY(key),ADD COLUMN default_access boolean DEFAULT true,ADD COLUMN scope text DEFAULT 'client',ADD COLUMN is_active boolean DEFAULT true,ADD COLUMN assignable_by_client boolean DEFAULT true,ADD COLUMN super_user_inherent boolean DEFAULT false;
 CREATE TABLE fixture_permissions(actor uuid,entity uuid,permission text);
 CREATE FUNCTION public.has_entity_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.fixture_permissions WHERE actor=$1 AND entity=$2 AND permission=$3)$$;
 `);
 const wa=read('20261016120000_verified_whatsapp_maintenance');
 await db.exec(wa.match(/CREATE TABLE public.whatsapp_requester_bindings\([\s\S]*?\n\);/)[0]);
 await db.exec(wa.match(/CREATE TABLE public.whatsapp_maintenance_inbox\([\s\S]*?\n\);/)[0]);
 await db.exec(wa.match(/CREATE FUNCTION public.receive_whatsapp_maintenance[\s\S]*?END;\$\$;/)[0]);
 await db.exec(`CREATE FUNCTION public.process_whatsapp_maintenance(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"status":"legacy"}'::jsonb$$;`);
 await db.exec(`ALTER TABLE communications_queue ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE ON communications_queue TO authenticated;
 ${['comm_queue_insert','comm_queue_select','comm_queue_update'].map(n=>schema.match(new RegExp(`CREATE POLICY "${n}"[^;]+;`))[0]).join('\n')}`);
 await db.exec(read('20261016180000_flow_statement_actions'));
});
test.after(async()=>db?.close());
test.beforeEach(async()=>{
 await owner();actor=randomUUID();entity=randomUUID();property=randomUUID();tenant=randomUUID();period=randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1)',[actor]);await db.query("SELECT set_config('test.actor',$1,false)",[actor]);
 await db.query("INSERT INTO entities(id,entity_name,entity_code) VALUES($1::uuid,'Fixture Company',$1::text)",[entity]);
 await db.query("INSERT INTO properties(id,entity_id,property_name) VALUES($1,$2,'Fixture Property')",[property,entity]);
 await db.query("INSERT INTO tenants(id,entity_id,tenant_name,statement_email,email_enabled,kyc_status) VALUES($1,$2,'Fixture Tenant','approved@example.test',true,'Pending')",[tenant,entity]);
 await db.query('INSERT INTO leases(id,client_id,lease_id,property_id,tenant_id) VALUES($1::uuid,$2::text,$1::text,$3,$4)',[randomUUID(),entity,property,tenant]);
 await db.query('INSERT INTO user_entity_access(user_id,entity_id) VALUES($1,$2)',[actor,entity]);
 await db.query("INSERT INTO fixture_permissions VALUES($1,$2,'communications.statement.prepare'),($1,$2,'communications.statement.send')",[actor,entity]);
 await db.query('INSERT INTO communication_preferences(entity_id,tenant_id) VALUES($1,$2)',[entity,tenant]);
 await db.query("INSERT INTO financial_periods(id,entity_id,period_name,period_type,period_start,period_end) VALUES($1,$2,'Fixture period','statement',(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')-interval '1 month')::date,(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')-interval '1 day')::date)",[period,entity]);
 await db.query("INSERT INTO statements_generated(entity_id,tenant_id,status,statement_data) VALUES($1,$2,'issued',$3)",[entity,tenant,{period_id:period,opening_balance:'0.00',closing_balance:'123.45',posted_lines:[{date:'2026-09-01',reference:'FIXTURE',description:'Synthetic issued fixture',debit:'123.45',credit:'0.00',balance:'123.45'}]}]);
 await user();
});
test('canonical issued snapshots produce real PDFs and one approved queue entry; replay never reclaims',async()=>{
 const a=await stage();assert.equal(a.manifest.attachments.length,1);assert.equal(Buffer.from(a.manifest.attachments[0].content,'base64').subarray(0,5).toString(),'%PDF-');
 const sent=await claim(a);assert.equal(sent.status,'submitting');assert.ok(sent.attempt_token);
 const again=await claim(a);assert.equal(again.status,'submitting');assert.equal(again.attempt_token,undefined);
 await owner();assert.equal((await db.query('SELECT count(*) FROM communications_queue WHERE flow_action_id=$1',[a.id])).rows[0].count,1);
 await db.exec('SET ROLE service_role');await rpc('finish_flow_statement',[a.id,sent.attempt_token,'submitted','real-provider-test-reference',null]);await user();assert.equal((await claim(a)).status,'submitted');
});
test('unauthorized and cross-entity resolution exposes no tenant records',async()=>{
 const a=await prepare(randomUUID(),'Fixture',{entity:randomUUID()});assert.equal(a.status,'clarification');assert.deepEqual(a.choices,[]);
 await owner();await db.query('DELETE FROM fixture_permissions WHERE actor=$1',[actor]);await user();assert.deepEqual((await prepare()).choices,[]);
 await assert.rejects(rpc('get_flow_statement',[randomUUID()]),/unavailable/);
});
test('ambiguous tenant resolution requires selection and never creates a queue item',async()=>{
 await owner();const t=randomUUID();await db.query("INSERT INTO tenants(id,entity_id,tenant_name,kyc_status) VALUES($1,$2,'Fixture Tenant Two','Pending')",[t,entity]);await db.query('INSERT INTO leases(id,client_id,lease_id,property_id,tenant_id) VALUES($1::uuid,$2::text,$1::text,$3,$4)',[randomUUID(),entity,property,t]);await user();const a=await prepare();assert.equal(a.status,'clarification');assert.equal(a.choices.length,2);
 assert.equal((await prepare(randomUUID(),'Fixture',{entity,property,tenant})).status,'preparing');
});
test('missing, draft and competing statements block rather than fabricate history',async()=>{
 await owner();await db.query("UPDATE statements_generated SET status='draft' WHERE tenant_id=$1",[tenant]);await user();assert.match((await prepare()).reason,/One issued statement/);
 await owner();await db.query("UPDATE statements_generated SET status='issued' WHERE tenant_id=$1",[tenant]);await db.query('INSERT INTO statements_generated(entity_id,tenant_id,status,statement_data) SELECT entity_id,tenant_id,status,statement_data FROM statements_generated WHERE tenant_id=$1',[tenant]);await user();assert.equal((await prepare()).status,'blocked');
});
test('recipient preference changes invalidate approval; explicit configuration required',async()=>{
 const a=await stage();await owner();await db.query("UPDATE tenants SET statement_email='changed@example.test' WHERE id=$1",[tenant]);await user();await assert.rejects(claim(a),/changed/);
 await owner();await db.query('DELETE FROM communication_preferences WHERE tenant_id=$1',[tenant]);await user();assert.match((await prepare()).reason,/preferences required/);
});
test('issued document substitution and stale approval are denied',async()=>{
 const a=await stage();await assert.rejects(rpc('claim_flow_statement',[a.id,'forged']),/does not match/);
 await owner();await db.query("UPDATE statements_generated SET statement_data=jsonb_set(statement_data,'{closing_balance}','999') WHERE tenant_id=$1",[tenant]);await user();await assert.rejects(claim(a),/changed/);
});
test('direct private access and forged attachment staging are denied',async()=>{
 const a=await prepare();const manifest=await statementManifest(a.snapshot);
 await assert.rejects(rpc('stage_flow_statement',[a.id,a.snapshot,manifest]),/permission denied/);
 await assert.rejects(db.query('SELECT * FROM flow_statement_actions'),/permission denied/);
 await owner();await db.exec('SET ROLE service_role');manifest.attachments[0].sha256='0'.repeat(64);await assert.rejects(rpc('stage_flow_statement',[a.id,a.snapshot,manifest]),/Invalid statement attachment/);
});
test('expired approval and revoked authority block canonical claim',async()=>{
 const a=await stage();await owner();await db.query("UPDATE flow_statement_actions SET expires_at=now()-interval '1 second' WHERE id=$1",[a.id]);await user();await assert.rejects(claim(a),/expired/);
 await owner();await db.query("DELETE FROM fixture_permissions WHERE actor=$1 AND permission='communications.statement.send'",[actor]);await user();await assert.rejects(claim(a),/denied/);
});
test('queued duplicate preparations converge and request-key conflicts fail (one embedded session)',async()=>{
 const key=randomUUID();const [a,b]=await Promise.all([prepare(key),prepare(key)]);assert.equal(a.id,b.id);
 await assert.rejects(rpc('prepare_flow_statements',[key,'Different instruction','Fixture',1,null,null,null]),/reused/);
});
test('uncertain submission cannot be retried; definitive rejection permits approved retry with new fencing token',async()=>{
 const a=await stage(),first=await claim(a);await owner();await db.exec('SET ROLE service_role');await rpc('finish_flow_statement',[a.id,first.attempt_token,'failed',null,'Rejected']);await user();const retry=await claim(a);assert.notEqual(first.attempt_token,retry.attempt_token);
 await owner();await db.exec('SET ROLE service_role');await assert.rejects(rpc('finish_flow_statement',[a.id,first.attempt_token,'submitted','wrong',null]),/unavailable/);await rpc('finish_flow_statement',[a.id,retry.attempt_token,'reconciliation_required',null,'Timeout']);await user();assert.equal((await claim(a)).attempt_token,undefined);
});
test('audit failure atomically rolls back approval and queue insertion',async()=>{
 const a=await stage();await owner();await db.exec("CREATE FUNCTION fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.event_type='flow_approved' THEN RAISE EXCEPTION 'audit outage';END IF;RETURN NEW;END$$;CREATE TRIGGER fixture_fail_audit BEFORE INSERT ON financial_timeline FOR EACH ROW EXECUTE FUNCTION fixture_fail_audit();");await user();
 try{await assert.rejects(claim(a),/audit outage/);assert.equal((await rpc('get_flow_statement',[a.id])).status,'review');}finally{await owner();await db.exec('DROP TRIGGER fixture_fail_audit ON financial_timeline;DROP FUNCTION fixture_fail_audit()');await user();}
 assert.equal((await claim(a)).status,'submitting');
});
test('legacy queue CRUD cannot replace approved recipient, body or attachments',async()=>{
 const a=await stage();await claim(a);await owner();await db.exec('GRANT SELECT,UPDATE ON communications_queue TO authenticated');await user();const changed=await db.query("UPDATE communications_queue SET recipient='other@example.test' WHERE flow_action_id=$1 RETURNING id",[a.id]);assert.equal(changed.rows.length,0);assert.equal((await db.query('SELECT * FROM communications_queue WHERE flow_action_id=$1',[a.id])).rows.length,0);await assert.rejects(db.query("INSERT INTO communications_queue(entity_id,tenant_id,type,channel,recipient,body,flow_action_id) VALUES($1,$2,'statement','email','forged@example.test','forged',$3)",[entity,tenant,a.id]),/canonical command/);
});
test('WhatsApp uses verified binding and canonical action, and inbox replay returns same reference',async()=>{
 await owner();await db.query("INSERT INTO whatsapp_requester_bindings(actor_id,entity_id,property_id,phone,code_hash,verified_at) VALUES($1,$2,$3,'+27821234567',$4,now())",[actor,entity,property,randomUUID().replaceAll('-','').repeat(2)]);
 const id=await rpc('receive_whatsapp_maintenance',[randomUUID(),{phone:'+27821234567',kind:'flow_statement',query:'Fixture',months:1,body:'Send Fixture their last one month of statements'}]);await db.exec('SET ROLE service_role');const result=await rpc('process_whatsapp_maintenance',[id]);assert.equal(result.status,'flow_prepared');assert.deepEqual(await rpc('process_whatsapp_maintenance',[id]),result);await user();assert.equal((await rpc('get_flow_statement',[result.actionId])).status,'preparing');
});
test('new request IDs cannot cause duplicate sends for the same recipient and issued document set',async()=>{
 const a=await stage(),b=await stage();await claim(a);await assert.rejects(claim(b),/already have a submission/);
});
test('six months resolve six authoritative periods and render six readable PDF documents',async()=>{
 await owner();for(let i=2;i<=6;i++){
  const id=randomUUID();await db.query("INSERT INTO financial_periods(id,entity_id,period_name,period_type,period_start,period_end) VALUES($1,$2,$3,'statement',(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')-make_interval(months=>$4))::date,(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')-make_interval(months=>$4-1)-interval '1 day')::date)",[id,entity,`Fixture month ${i}`,i]);
  await db.query("INSERT INTO statements_generated(entity_id,tenant_id,status,statement_data) SELECT entity_id,tenant_id,status,jsonb_set(statement_data,'{period_id}',to_jsonb($2::text)) FROM statements_generated WHERE tenant_id=$1 LIMIT 1",[tenant,id]);
 }
 await user();const a=await rpc('prepare_flow_statements',[randomUUID(),'Send Fixture their last six months of statements','Fixture',6,entity,property,tenant]);assert.equal(a.status,'preparing',a.reason);assert.equal(a.snapshot.documents.length,6);
 const manifest=await statementManifest(a.snapshot);const {PDFDocument}=await import('pdf-lib');for(const f of manifest.attachments){assert.ok((await PDFDocument.load(Buffer.from(f.content,'base64'))).getPageCount()>0);}assert.equal(manifest.attachments.length,6);
});
test('multi-property tenant account and unsupported issued data are blocked without fabricated documents',async()=>{
 await owner();await db.query("UPDATE statements_generated SET statement_data=statement_data-'posted_lines' WHERE tenant_id=$1",[tenant]);await user();assert.match((await prepare()).reason,/posted-ledger snapshot/);
 await owner();await db.query("INSERT INTO leases(id,client_id,lease_id,property_id,tenant_id) VALUES($1::uuid,'fixture',$1::text,$2,$3)",[randomUUID(),randomUUID(),tenant]);await user();assert.match((await prepare()).reason,/multiple property accounts/);
});
test('web application service executes real DB claim/finish boundaries and never re-sends accepted messages',async()=>{
 const a=await stage();let sends=0;deliverImpl=async request=>{sends++;assert.equal(request.attachments.length,1);assert.equal(request.recipient,'approved@example.test');return {success:true,messageId:'provider-accepted',channel:'email'};};
 const dbClient={rpc:async(name,args)=>{try{return {data:await rpc(name,Object.values(args))};}catch(error){return {error};}}};
 const serviceClient={rpc:async(name,args)=>{await owner();await db.exec('SET ROLE service_role');try{return await dbClient.rpc(name,args);}finally{await user();}}};
 const oldKey=process.env.SENDGRID_API_KEY,oldFrom=process.env.SENDGRID_FROM_EMAIL;process.env.SENDGRID_API_KEY='synthetic-test-only';process.env.SENDGRID_FROM_EMAIL='sender@example.test';
 try{assert.equal((await approveStatements(dbClient,serviceClient,a.id,a.manifest_hash)).status,'submitted');assert.equal((await approveStatements(dbClient,serviceClient,a.id,a.manifest_hash)).status,'submitted');assert.equal(sends,1);}finally{if(oldKey===undefined)delete process.env.SENDGRID_API_KEY;else process.env.SENDGRID_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.SENDGRID_FROM_EMAIL;else process.env.SENDGRID_FROM_EMAIL=oldFrom;}
});
test('Flow audit cannot be rewritten and cross-actor action read is denied',async()=>{
 const a=await stage();await owner();await assert.rejects(db.query("UPDATE financial_timeline SET description='forged' WHERE reference_id=$1",[a.id]),/immutable/);await db.query("SELECT set_config('test.actor',$1,false)",[randomUUID()]);await user();await assert.rejects(rpc('get_flow_statement',[a.id]),/unavailable/);
});
test('WhatsApp unverified or expired bindings do not disclose tenant or document details',async()=>{
 await owner();const id=await rpc('receive_whatsapp_maintenance',[randomUUID(),{phone:'+27829999999',kind:'flow_statement',query:'Fixture',months:1,body:'Send Fixture their last one month of statements'}]);await db.exec('SET ROLE service_role');const result=await rpc('process_whatsapp_maintenance',[id]);assert.equal(result.status,'clarification');assert.equal(result.actionId,undefined);assert.ok(!JSON.stringify(result).includes('approved@example.test'));
});
