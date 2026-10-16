import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadTypeScript } from '../execution/load-typescript.mjs';
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const schema = read('20260826131729_remote_schema');
const foundation = read('20260928140734_establish_client_account_foundation');
const admin = read('20260928175716_establish_canonical_client_administration');
const table = (source, name, quoted = false) => source.match(new RegExp(quoted ? `CREATE TABLE "public"\\."${name}" \\([\\s\\S]*?\\n\\);` : `CREATE TABLE public\\.${name} \\([\\s\\S]*?\\n\\);`))[0];
let db, actor, email;
const template = '00000000-0000-0000-0000-000000000000';
test.before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon, service_role;
    ${['commission_type','broker_status'].map(n=>schema.match(new RegExp(`CREATE TYPE \"public\"\\.\"${n}\" AS ENUM \\([\\s\\S]*?\\);`))[0]).join('\n')}
    ${['entities','profiles','user_entity_access','user_entities','chart_of_accounts','posting_templates','posting_template_lines','financial_periods','invoice_configs','statement_configs','permission_catalogue','accounting_config','tax_config','financial_timeline','journals','invoices','charges','journal_lines','general_ledger','tenants','properties','suppliers','brokers','bank_accounts','leases','sub_ledger_entries'].map(n => table(schema,n,true)).join('\n')}
    ALTER TABLE entities ADD PRIMARY KEY(id), ADD COLUMN client_account_id uuid, ADD UNIQUE(entity_code);
    ALTER TABLE profiles ADD PRIMARY KEY(id);
    ALTER TABLE user_entities ADD UNIQUE(user_id,entity_id);
    ALTER TABLE permission_catalogue ADD PRIMARY KEY(key), ADD COLUMN scope text DEFAULT 'client', ADD COLUMN is_active boolean DEFAULT true, ADD COLUMN assignable_by_client boolean DEFAULT true, ADD COLUMN super_user_inherent boolean DEFAULT false, ADD COLUMN default_access boolean DEFAULT true;
    ${['client_accounts','client_role_types','client_users','access_profiles','access_profile_permissions','client_user_access_profiles'].map(n => table(foundation,n)).join('\n')}
    ALTER TABLE access_profiles ADD COLUMN system_key text;
  `);
  await db.exec(admin.match(/CREATE OR REPLACE FUNCTION public.sync_standard_access_profile_internal[\s\S]*?\$\$;/)[0]);
  await db.exec(read('20260928150216_establish_canonical_client_provisioning').match(/CREATE OR REPLACE FUNCTION public.provision_entity_financial_foundation[\s\S]*?\$function\$;/)[0]);
  await db.exec('REVOKE ALL ON FUNCTION sync_standard_access_profile_internal(uuid,uuid),provision_entity_financial_foundation(uuid) FROM PUBLIC,anon,authenticated');
  await db.exec(read('20261016140000_retry_safe_client_onboarding'));
  await db.exec(admin.match(/CREATE OR REPLACE FUNCTION public.is_active_client_super_user[\s\S]*?\$\$;/)[0]);
  await db.exec("CREATE TABLE fixture_permissions(actor uuid,entity uuid,permission text); CREATE FUNCTION public.has_entity_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.fixture_permissions WHERE actor=$1 AND entity=$2 AND permission=$3) $$;");
  await db.exec(read('20261016160000_client_financial_readiness'));
  await db.exec('ALTER TABLE journal_lines ADD COLUMN bank_account_id uuid');
  await db.exec(read('20260916120000_add_bank_account_dimension_to_journal_lines').match(/CREATE OR REPLACE FUNCTION public.atomic_post_journal[\s\S]*?\$function\$;/)[0].replace('public.atomic_post_journal(', 'public.atomic_post_journal_internal('));
  await db.exec('REVOKE ALL ON FUNCTION public.atomic_post_journal_internal(jsonb,jsonb) FROM PUBLIC,anon,authenticated');
  await db.exec(read('20261016000000_atomic_commencement_invoice').match(/CREATE FUNCTION public.post_journal_tenant_ledger[\s\S]*?\$function\$;/)[0]);
  await db.exec(read('20261016060000_maintenance_invoice_accounting').match(/CREATE FUNCTION public.post_journal_supplier_ledger[\s\S]*?\$function\$;/)[0]);
  await db.exec(read('20261016060000_maintenance_invoice_accounting').match(/CREATE OR REPLACE FUNCTION public.atomic_post_journal[\s\S]*?\$function\$;/)[0]);
  await db.exec('REVOKE ALL ON FUNCTION public.post_journal_tenant_ledger(uuid),public.post_journal_supplier_ledger(uuid) FROM PUBLIC,anon,authenticated,service_role');



});
test.beforeEach(async () => {
  actor = randomUUID(); email = `${actor}@example.test`;
  await db.exec('RESET ROLE');
  await db.query('INSERT INTO auth.users VALUES($1,$2)',[actor,email]);
  await db.query("SELECT set_config('test.actor',$1,false)",[actor]);
  await db.exec('SET ROLE authenticated');
});
test.after(async () => db.close());
async function provision(overrides = {}) {
  const p = {client:'Pilot',entity:'Pilot Ltd',code:actor,role:'Director',name:'Pilot User',email,...overrides};
  return (await db.query('SELECT provision_client_account($1,$2,$3,$4,$5,$6) result',Object.values(p))).rows[0].result;
}
async function count(table, where = '', args = []) {
  await db.exec('RESET ROLE');
  try { return (await db.query(`SELECT count(*)::int n FROM ${table} ${where}`,args)).rows[0].n; }
  finally { await db.exec('SET ROLE authenticated'); }
}
async function rpc(name,args){return (await db.query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;}
async function state(entity){return rpc('get_entity_financial_readiness',[entity]);}
const config={accounts:[
 {code:'CLIENT-AR',name:'Client receivables',type:'asset',category:'control',vatCategory:'non_vatable',vatRate:0,isVatable:false},
 {code:'CLIENT-AP',name:'Client payables',type:'liability',category:'control',vatCategory:'non_vatable',vatRate:0,isVatable:false},
 {code:'CLIENT-DEP',name:'Refundable deposits',type:'liability',category:'control',vatCategory:'non_vatable',vatRate:0,isVatable:false},
],taxes:[{code:'CLIENT-NOVAT',name:'Client non-registered treatment',rate:0,recoverable:false}],mappings:[{role:'ar_control',accountCode:'CLIENT-AR'},{role:'ap_control',accountCode:'CLIENT-AP'},{role:'deposit_liability',accountCode:'CLIENT-DEP'}]};
async function load(entity,c=config){return rpc('import_entity_financial_configuration',[entity,(await state(entity)).revision,c]);}
async function review(entity,vat='not_registered',revision){return rpc('review_entity_financial_configuration',[entity,revision??(await state(entity)).revision,vat,'accrual','ZAR',3]);}
async function journal(entity){await db.exec('RESET ROLE');try{return await db.query("INSERT INTO journals(entity_id,journal_number,journal_type,source_event,source_id,is_posted) VALUES($1,'TEST','normal','fixture_post',$2,true)",[entity,randomUUID()]);}finally{await db.exec('SET ROLE authenticated');}}
test('organisation creation succeeds with no global financial templates, no copied accounts and atomic membership/receipt',async()=>{
 const a=await provision();assert.equal(a.financial_foundation.status,'configuration_required');
 assert.deepEqual(await provision(),a);
 assert.equal(await count('client_users','WHERE user_id=$1',[actor]),1);
 for(const table of ['chart_of_accounts','financial_periods','invoice_configs','posting_templates'])assert.equal(await count(table,'WHERE entity_id=$1',[a.entity_id]),0);
 const s=await state(a.entity_id);assert.equal(s.reviewed,false);assert.equal(s.journal,false);
 await assert.rejects(journal(a.entity_id),/not ready/);
});
test('explicit client import and review enable operation-specific readiness without a system chart',async()=>{
 const {entity_id:e}=await provision();let s=await load(e);
 assert.equal(s.reviewed,false);assert.equal(s.accounts.length,3);await assert.rejects(journal(e),/not ready/);
 s=await review(e);assert.equal(s.reviewed,true);assert.equal(s.journal,true);assert.equal(s.receivable,true);assert.equal(s.payable,true);assert.equal(s.deposit,true);
 await journal(e);
 assert.equal(await count('financial_timeline',"WHERE entity_id=$1 AND event_type='configuration_reviewed'",[e]),1);
});
test('changed configuration invalidates review, rejects stale review and blocks posting until re-reviewed',async()=>{
 const {entity_id:e}=await provision();await load(e);const prior=await review(e);
 await db.exec('RESET ROLE');await db.query("UPDATE chart_of_accounts SET account_name='Client revised name' WHERE entity_id=$1 AND gl_code='CLIENT-AR'",[e]);await db.exec('SET ROLE authenticated');
 assert.equal((await state(e)).reviewed,false);
 await assert.rejects(review(e,'not_registered',prior.revision),/Configuration changed/);
 await assert.rejects(journal(e),/not ready/);await review(e);await journal(e);
});
test('foreign entity, anonymous and direct readiness-table access are denied',async()=>{
 const {entity_id:e}=await provision();await db.query("SELECT set_config('test.actor',$1,false)",[randomUUID()]);
 await assert.rejects(state(e),/access denied/);await assert.rejects(load(e),/access denied/);
 await assert.rejects(rpc('review_entity_financial_configuration',[e,0,'not_registered','accrual','ZAR',3]),/authority/);
 await assert.rejects(db.query('SELECT * FROM entity_financial_readiness'),/permission denied/);
 await db.exec('SET ROLE anon');await assert.rejects(state(e),/permission denied/);
});
test('imports are additive and replay-safe; conflicting values and hierarchy cycles roll back',async()=>{
 const {entity_id:e}=await provision();const first=await load(e);const retry=await load(e);assert.equal(retry.revision,first.revision);assert.equal(retry.accounts.length,3);
 const conflict=structuredClone(config);conflict.accounts[0].name='Overwrite';await assert.rejects(load(e,conflict),/conflicts/);
 const cycle=structuredClone(config);cycle.accounts[0].parentCode='CLIENT-AP';cycle.accounts[1].parentCode='CLIENT-AR';await assert.rejects(load(e,cycle),/cycle/);
 assert.equal((await state(e)).accounts.every(a=>a.parent_account_id===null),true);
});
test('registered VAT requires separate valid control mappings and nonregistered tax codes cannot recover VAT',async()=>{
 const {entity_id:e}=await provision();await load(e);const registered=await review(e,'registered');assert.equal(registered.journal,true);assert.equal(registered.receivable,false);assert.equal(registered.payable,false);
 await db.exec('RESET ROLE');await db.query('UPDATE tax_config SET is_recoverable=true WHERE entity_id=$1',[e]);await db.exec('SET ROLE authenticated');
 await assert.rejects(review(e),/configuration incomplete/);
});
test('billing approval and invoice issuance are blocked before readiness; draft capture remains available',async()=>{
 const {entity_id:e}=await provision();await db.exec('RESET ROLE');
 await db.query("INSERT INTO invoices(entity_id,invoice_status) VALUES($1,'draft')",[e]);
 await assert.rejects(db.query("INSERT INTO invoices(entity_id,invoice_status) VALUES($1,'issued')",[e]),/not ready/);
 await assert.rejects(db.query("INSERT INTO charges(entity_id,charge_type,status) VALUES($1,'rent','approved')",[e]),/not ready/);
 await db.exec('SET ROLE authenticated');await load(e);await review(e);await db.exec('RESET ROLE');
 await db.query("INSERT INTO invoices(entity_id,invoice_status) VALUES($1,'issued')",[e]);
 await db.query("INSERT INTO charges(entity_id,charge_type,status) VALUES($1,'deposit','approved')",[e]);
 await db.exec('SET ROLE authenticated');
});
test('audit failure rolls back client review and leaves posting disabled',async()=>{
 const {entity_id:e}=await provision();await load(e);
 await db.exec("RESET ROLE; CREATE FUNCTION fixture_readiness_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit outage';END$$; CREATE TRIGGER fixture_readiness_failure BEFORE INSERT ON financial_timeline FOR EACH ROW EXECUTE FUNCTION fixture_readiness_failure(); SET ROLE authenticated");
 try{await assert.rejects(review(e),/audit outage/);assert.equal((await state(e)).reviewed,false);}finally{await db.exec('RESET ROLE; DROP TRIGGER fixture_readiness_failure ON financial_timeline; DROP FUNCTION fixture_readiness_failure(); SET ROLE authenticated');}
 assert.equal((await review(e)).reviewed,true);
});
test('actual canonical journal primitive blocks incomplete setup, then writes matching GL lines after review and preserves replay',async()=>{
 const {entity_id:e}=await provision();const s=await load(e);const id=randomUUID();
 const j={id,entity_id:e,journal_number:id,journal_type:'normal',source_event:'fixture_atomic',source_id:id};
 const lines=s.accounts.slice(0,2).map((a,index)=>({id:randomUUID(),entity_id:e,account_id:a.id,debit_amount:index===0?100:0,credit_amount:index===1?100:0}));
 await db.exec('RESET ROLE');await assert.rejects(rpc('atomic_post_journal_internal',[j,lines]),/not ready/);await db.exec('SET ROLE authenticated');
 assert.equal(await count('general_ledger','WHERE entity_id=$1',[e]),0);
 await review(e);await db.exec('RESET ROLE');
 assert.equal(await rpc('atomic_post_journal_internal',[j,lines]),id);assert.equal(await rpc('atomic_post_journal_internal',[j,lines]),id);
 const balance=(await db.query('SELECT sum(debit_amount-credit_amount)::text balance,count(*)::int n FROM general_ledger WHERE entity_id=$1',[e])).rows[0];assert.equal(Number(balance.balance),0);assert.equal(balance.n,2);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc('review_entity_financial_configuration',[e,(await state(e)).revision,'not_registered','cash','USD',1]),/governed accounting policy transition/);
});
test('failed receipt write still rolls back account creation without financial provisioning',async()=>{
 await db.exec("RESET ROLE; CREATE FUNCTION fail_new_receipt() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'receipt failure';END$$; CREATE TRIGGER fail_new_receipt BEFORE INSERT ON client_onboarding_receipts FOR EACH ROW EXECUTE FUNCTION fail_new_receipt(); SET ROLE authenticated");
 try {await assert.rejects(provision(),/receipt failure/);assert.equal(await count('client_users','WHERE user_id=$1',[actor]),0);assert.equal(await count('entities','WHERE entity_code=$1',[actor]),0);}finally{await db.exec('RESET ROLE; DROP TRIGGER fail_new_receipt ON client_onboarding_receipts; DROP FUNCTION fail_new_receipt(); SET ROLE authenticated');}
 assert.equal((await provision()).status,'provisioned');
});
test('VAT policy changes advance revision and prevent stale approval; review evidence retains the configuration snapshot',async()=>{
 const {entity_id:e}=await provision();await load(e);const first=await review(e);const changed=await review(e,'registered');
 assert.ok(changed.revision>first.revision);
 await assert.rejects(review(e,'not_registered',first.revision),/Configuration changed/);
 await db.exec('RESET ROLE');const audit=(await db.query("SELECT metadata FROM financial_timeline WHERE entity_id=$1 AND event_type='configuration_reviewed' ORDER BY created_at DESC LIMIT 1",[e])).rows[0].metadata;
 assert.equal(audit.accounts.length,3);assert.equal(audit.taxes.length,1);assert.equal(audit.account_mappings.length,3);
 await db.exec('SET ROLE authenticated');
});
test('shared control mappings and nonregistered VAT account settings block readiness',async()=>{
 const {entity_id:e}=await provision();await load(e);
 await db.exec('RESET ROLE');await db.query("UPDATE accounting_config SET account_id=(SELECT id FROM chart_of_accounts WHERE entity_id=$1 AND gl_code='CLIENT-AP') WHERE entity_id=$1 AND business_role='deposit_liability'",[e]);await db.exec('SET ROLE authenticated');
 await assert.rejects(review(e),/Control accounts/);
 await db.exec('RESET ROLE');await db.query("UPDATE accounting_config SET account_id=(SELECT id FROM chart_of_accounts WHERE entity_id=$1 AND gl_code='CLIENT-DEP') WHERE entity_id=$1 AND business_role='deposit_liability'",[e]);await db.query("UPDATE chart_of_accounts SET vat_rate=15,is_vatable=true WHERE entity_id=$1 AND gl_code='CLIENT-AR'",[e]);await db.exec('SET ROLE authenticated');
 await assert.rejects(review(e),/account VAT settings/);
});
test('entity visibility alone cannot grant configuration authority, including legacy direct writes',async()=>{
 const {entity_id:e}=await provision();await load(e);const outsider=randomUUID();
 await db.exec('RESET ROLE');await db.query('INSERT INTO auth.users VALUES($1,$2)',[outsider,`${outsider}@example.test`]);await db.query('INSERT INTO user_entity_access(user_id,entity_id) VALUES($1,$2)',[outsider,e]);await db.query("SELECT set_config('test.actor',$1,false)",[outsider]);await db.exec('GRANT UPDATE,SELECT ON chart_of_accounts TO authenticated; SET ROLE authenticated');
 assert.equal((await state(e)).can_manage,false);
 await assert.rejects(rpc('import_entity_financial_configuration',[e,(await state(e)).revision,config]),/authority/);
 await assert.rejects(db.query("UPDATE chart_of_accounts SET account_name='Unauthorised' WHERE entity_id=$1",[e]),/authority/);
});
test('suspended client administrator cannot import or approve configuration',async()=>{
 const {entity_id:e}=await provision();await load(e);await db.exec('RESET ROLE');await db.query("UPDATE client_users SET status='suspended' WHERE user_id=$1",[actor]);await db.exec('SET ROLE authenticated');
 await assert.rejects(review(e),/authority/);
});
test('unconfigured payables cannot post maintenance journals despite valid generic financial configuration',async()=>{
 const {entity_id:e}=await provision();const basic=structuredClone(config);basic.mappings=[];await load(e,basic);const r=await review(e);assert.equal(r.journal,true);assert.equal(r.payable,false);
 await db.exec('RESET ROLE');await assert.rejects(db.query("INSERT INTO journals(entity_id,journal_number,journal_type,source_event,source_id,is_posted) VALUES($1,'AP','normal','maintenance_supplier_invoice',$2,true)",[e,randomUUID()]),/not ready for payable/);await db.exec('SET ROLE authenticated');
});
test('configuration evidence cannot be forged or rewritten through timeline CRUD',async()=>{
 const {entity_id:e}=await provision();await load(e);await review(e);
 await db.exec('RESET ROLE');
 await assert.rejects(db.query("UPDATE financial_timeline SET description='changed' WHERE entity_id=$1 AND event_type='configuration_reviewed'",[e]),/immutable/);
 await db.exec('GRANT INSERT ON financial_timeline TO authenticated; SET ROLE authenticated');
 await assert.rejects(db.query("INSERT INTO financial_timeline(entity_id,reference_type,reference_id,event_type,description) VALUES($1::uuid,'entity',$1::text,'configuration_reviewed','forged')",[e]),/canonical command/);
});
test('nullable legacy statuses cannot bypass readiness on posting or issuance transitions',async()=>{
 const {entity_id:e}=await provision();await db.exec('RESET ROLE');
 const invoice=(await db.query('INSERT INTO invoices(entity_id,invoice_status) VALUES($1,NULL) RETURNING id',[e])).rows[0].id;
 await assert.rejects(db.query("UPDATE invoices SET invoice_status='issued' WHERE id=$1",[invoice]),/not ready/);
 const j=(await db.query("INSERT INTO journals(entity_id,journal_number,journal_type,source_event,is_posted) VALUES($1,'NULL','normal','fixture_null',NULL) RETURNING id",[e])).rows[0].id;
 await assert.rejects(db.query('UPDATE journals SET is_posted=true WHERE id=$1',[j]),/not ready/);
 await db.exec('SET ROLE authenticated');
});
test('public journal service retains authorization, period controls, tenant/AP projection, balanced GL and replay under readiness gates',async()=>{
 const {entity_id:e}=await provision();const s=await load(e);const id=randomUUID(),period=randomUUID(),tenant=randomUUID(),supplier=randomUUID();
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO fixture_permissions VALUES($1,$2,'finance.journal.post')",[actor,e]);
 await db.query("INSERT INTO financial_periods(id,entity_id,period_name,period_start,period_end,status,period_type,workflow_phase) VALUES($1,$2,'Fixture period','2026-10-01','2026-10-31','open','financial','open')",[period,e]);
 await db.query("INSERT INTO tenants(id,entity_id,tenant_name,kyc_status) VALUES($1,$2,'Fixture tenant','Pending')",[tenant,e]);
 await db.query("INSERT INTO suppliers(id,entity_id,supplier_name) VALUES($1,$2,'Fixture supplier')",[supplier,e]);
 await db.exec('SET ROLE authenticated');
 const j={id,entity_id:e,period_id:period,journal_number:id,journal_type:'normal',source_event:'fixture_public',source_id:id};
 const lines=[{id:randomUUID(),entity_id:e,account_id:s.accounts.find(a=>a.gl_code==='CLIENT-AR').id,tenant_id:tenant,debit_amount:100,credit_amount:0},{id:randomUUID(),entity_id:e,account_id:s.accounts.find(a=>a.gl_code==='CLIENT-AP').id,supplier_id:supplier,debit_amount:0,credit_amount:100}];
 await assert.rejects(rpc('atomic_post_journal',[j,lines]),/not ready/);
 assert.equal(await count('journals','WHERE entity_id=$1',[e]),0);
 await review(e);
 await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE id=$1",[period]);await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc('atomic_post_journal',[j,lines]),/Open entity financial period/);
 await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='open',workflow_phase='open' WHERE id=$1",[period]);await db.exec('SET ROLE authenticated');
 assert.equal(await rpc('atomic_post_journal',[j,lines]),id);
 assert.equal(await count('general_ledger','WHERE entity_id=$1',[e]),2);
 assert.equal(await count('sub_ledger_entries','WHERE entity_id=$1',[e]),2);
 await db.exec('RESET ROLE');await db.query("UPDATE tax_config SET tax_name='Updated classification label' WHERE entity_id=$1",[e]);await db.exec('SET ROLE authenticated');
 assert.equal((await state(e)).reviewed,false);
 assert.equal(await rpc('atomic_post_journal',[j,lines]),id,'Committed replay recovers without creating a new posting');
 assert.equal(await count('general_ledger','WHERE entity_id=$1',[e]),2);
 const next={...j,id:randomUUID(),source_id:randomUUID()};await assert.rejects(rpc('atomic_post_journal',[next,lines.map(l=>({...l,id:randomUUID()}))]),/not ready/);
 await db.query("SELECT set_config('test.actor',$1,false)",[randomUUID()]);await assert.rejects(rpc('atomic_post_journal',[next,lines]),/permission denied/);
});
test('direct GL writers cannot create ledger entries while configuration is unreviewed or under another entity',async()=>{
 const {entity_id:e}=await provision();const s=await load(e);await review(e);
 const j={id:randomUUID(),entity_id:e,journal_number:'GL-DIRECT',journal_type:'normal',source_event:'fixture_gl_direct',source_id:randomUUID()};
 const lines=s.accounts.slice(0,2).map((a,i)=>({id:randomUUID(),entity_id:e,account_id:a.id,debit_amount:i===0?10:0,credit_amount:i===1?10:0}));
 await db.exec('RESET ROLE');await rpc('atomic_post_journal_internal',[j,lines]);
 await assert.rejects(db.query('INSERT INTO general_ledger(entity_id,account_id,journal_line_id,debit_amount,credit_amount) VALUES($1,$2,$3,11,0)',[e,lines[0].account_id,lines[0].id]),/match its canonical/);
 await assert.rejects(db.query('INSERT INTO general_ledger(entity_id,account_id,journal_line_id,debit_amount,credit_amount) VALUES($1,$2,$3,10,0)',[e,lines[0].account_id,lines[0].id]),/already projected/);
 await db.query("UPDATE tax_config SET tax_name='Changed' WHERE entity_id=$1",[e]);
 await assert.rejects(db.query('INSERT INTO general_ledger(entity_id,account_id,journal_line_id,debit_amount,credit_amount) VALUES($1,$2,$3,10,0)',[e,lines[0].account_id,lines[0].id]),/not ready/);
 await assert.rejects(db.query('INSERT INTO general_ledger(entity_id,account_id,journal_line_id,debit_amount,credit_amount) VALUES($1,$2,$3,10,0)',[randomUUID(),lines[0].account_id,lines[0].id]),/same entity/);
 await db.exec('SET ROLE authenticated');
});
test('posting template and formula edits invalidate review and are included in client review evidence',async()=>{
 const {entity_id:e}=await provision();await load(e);await review(e);
 await db.exec('RESET ROLE');const template=(await db.query("INSERT INTO posting_templates(entity_id,business_event) VALUES($1,'fixture_template') RETURNING id",[e])).rows[0].id;await db.exec('SET ROLE authenticated');
 assert.equal((await state(e)).reviewed,false);await review(e);
 await db.exec('RESET ROLE');await db.query("INSERT INTO posting_template_lines(template_id,sequence,direction,account_resolver,amount_formula) VALUES($1,1,'debit','fixture','amount')",[template]);await db.exec('SET ROLE authenticated');
 assert.equal((await state(e)).reviewed,false);const r=await review(e);assert.equal(r.posting_templates.length,1);assert.equal(r.posting_template_lines.length,1);
});
test('queued provisioning retries create one initial administrator, client graph and receipt (single embedded session)',async()=>{
 const [a,b,c]=await Promise.all([provision(),provision(),provision()]);assert.deepEqual(a,b);assert.deepEqual(b,c);
 assert.equal(await count('client_users','WHERE user_id=$1 AND is_super_user=true',[actor]),1);
 assert.equal(await count('client_onboarding_receipts','WHERE user_id=$1',[actor]),1);
 assert.equal(await count('user_entity_access','WHERE user_id=$1',[actor]),1);
});
