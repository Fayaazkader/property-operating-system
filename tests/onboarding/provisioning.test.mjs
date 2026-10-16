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
    ${['entities','profiles','user_entity_access','user_entities','chart_of_accounts','posting_templates','posting_template_lines','financial_periods','invoice_configs','statement_configs','permission_catalogue'].map(n => table(schema,n,true)).join('\n')}
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
  await db.query("INSERT INTO entities(id,entity_code,entity_name) VALUES($1,'TEMPLATE','Template')",[template]);
  await db.query("INSERT INTO chart_of_accounts(entity_id,gl_code,account_name,account_type,category) VALUES($1,'1000','Assets','asset','assets')",[template]);
  await db.query("INSERT INTO chart_of_accounts(entity_id,gl_code,account_name,account_type,category,parent_account_id) SELECT $1,'1100','Cash','asset','assets',id FROM chart_of_accounts WHERE entity_id=$1 AND gl_code='1000'",[template]);
  const t = (await db.query("INSERT INTO posting_templates(entity_id,business_event) VALUES($1,'fixture_event') RETURNING id",[template])).rows[0].id;
  await db.query("INSERT INTO posting_template_lines(template_id,sequence,direction,account_resolver,amount_formula) VALUES($1,1,'debit','1100','amount'),($1,2,'credit','1000','amount')",[t]);
  await db.exec("INSERT INTO permission_catalogue(key,category,name) VALUES('fixture.read','fixture','Read')");
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
test('canonical graph includes financial foundation and unchanged platform authority; lost response retries return same graph',async()=>{
  await db.exec('RESET ROLE');await db.query("INSERT INTO profiles(id,email,platform_role) VALUES($1,$2,'platform_admin')",[actor,email]);await db.exec('SET ROLE authenticated');
  const result=await provision(); const retry=await provision({code:'changed',client:'Not a rename'});
  assert.deepEqual(result,retry);
  assert.equal(await count('client_users','WHERE user_id=$1',[actor]),1);
  assert.equal(await count('client_onboarding_receipts','WHERE user_id=$1',[actor]),1);
  assert.equal(await count('profiles',"WHERE id=$1 AND platform_role='platform_admin'",[actor]),1);
  assert.equal(await count('chart_of_accounts','WHERE entity_id=$1',[result.entity_id]),2);
  assert.equal(await count('chart_of_accounts c JOIN chart_of_accounts p ON p.id=c.parent_account_id','WHERE c.entity_id=$1 AND p.entity_id=$1',[result.entity_id]),1);
  assert.equal(await count('financial_periods','WHERE entity_id=$1',[result.entity_id]),2);
  assert.equal(await count('posting_templates','WHERE entity_id=$1',[result.entity_id]),1);
  assert.equal(await count('invoice_configs','WHERE entity_id=$1',[result.entity_id]),1);
  assert.equal(await count('statement_configs','WHERE entity_id=$1',[result.entity_id]),1);
  assert.equal(await count('user_entity_access',"WHERE user_id=$1 AND role_id IS NULL AND org_role='read_only'",[actor]),1);
});
test('missing identity, spoofed email and blank input cannot provision',async()=>{
  await assert.rejects(provision({email:'other@example.test'}),/Email must match/);
  await assert.rejects(provision({entity:' '}),/Legal entity name/);
  await db.query("SELECT set_config('test.actor','',false)");
  await assert.rejects(provision(),/Authentication required/);
});
test('anonymous access and direct receipt or internal primitive access are denied',async()=>{
  await assert.rejects(db.query('SELECT * FROM client_onboarding_receipts'),/permission denied/);
  await assert.rejects(db.query('SELECT provision_entity_financial_foundation($1)',[template]),/permission denied/);
  await db.exec('SET ROLE anon');await assert.rejects(provision(),/permission denied/);
});
test('financial failure rolls back client, profile, membership and receipt; repaired retry succeeds',async()=>{
  await db.exec(`RESET ROLE; CREATE FUNCTION fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fixture financial outage';END$$; CREATE TRIGGER fixture_failure BEFORE INSERT ON invoice_configs FOR EACH ROW EXECUTE FUNCTION fixture_failure(); SET ROLE authenticated;`);
  await assert.rejects(provision(),/financial outage/);
  assert.equal(await count('profiles','WHERE id=$1',[actor]),0);
  assert.equal(await count('client_users','WHERE user_id=$1',[actor]),0);
  assert.equal(await count('entities','WHERE entity_code=$1',[actor]),0);
  assert.equal(await count('client_onboarding_receipts','WHERE user_id=$1',[actor]),0);
  await db.exec('RESET ROLE; DROP TRIGGER fixture_failure ON invoice_configs; DROP FUNCTION fixture_failure(); SET ROLE authenticated');
  assert.equal((await provision()).status,'provisioned');
});
test('legacy assignment and suspended membership cannot bypass administration through signup',async()=>{
  await db.exec('RESET ROLE');await db.query('INSERT INTO user_entity_access(user_id,entity_id) VALUES($1,$2)',[actor,template]);await db.exec('SET ROLE authenticated');
  await assert.rejects(provision(),/existing membership/);
  await db.exec('RESET ROLE');await db.query('DELETE FROM user_entity_access WHERE user_id=$1',[actor]);await db.exec('SET ROLE authenticated');
  const result=await provision();
  await db.exec('RESET ROLE');await db.query("UPDATE client_users SET status='suspended' WHERE user_id=$1",[actor]);await db.exec('SET ROLE authenticated');
  await assert.rejects(provision(),/administrator review/);
  assert.equal(await count('client_users','WHERE user_id=$1',[actor]),1);
  assert.ok(result.entity_id);
});
test('different actors receive isolated receipts and unique entity conflicts roll back',async()=>{
  await assert.rejects(provision({code:'TEMPLATE'}),/unique constraint/);
  assert.equal(await count('client_users','WHERE user_id=$1',[actor]),0);
  const a=await provision();const other=randomUUID();
  await db.exec('RESET ROLE');await db.query('INSERT INTO auth.users VALUES($1,$2)',[other,`${other}@example.test`]);await db.query("SELECT set_config('test.actor',$1,false)",[other]);await db.exec('SET ROLE authenticated');
  const b=await provision({code:other,email:`${other}@example.test`});
  assert.notEqual(a.entity_id,b.entity_id); assert.notEqual(a.client_account_id,b.client_account_id);
});
test('application service uses verified identity and actual canonical SQL result',async()=>{
  const {provisionInitialWorkspace}=loadTypeScript('lib/onboarding/service.ts');
  const client={auth:{getUser:async()=>({data:{user:{id:actor,email}},error:null})},rpc:async(name,params)=>{
    assert.equal(name,'provision_client_account');
    try {return {data:(await db.query('SELECT provision_client_account($1,$2,$3,$4,$5,$6) result',Object.values(params))).rows[0].result,error:null};}
    catch(error){return {data:null,error};}
  }};
  const details={fullName:'User',clientName:'Client',entityName:'Entity',entityCode:actor,roleName:'Manager'};
  const first=await provisionInitialWorkspace(client,details);
  assert.deepEqual(await provisionInitialWorkspace(client,details),first);
});
test('missing canonical financial seeds cannot silently produce an empty foundation',async()=>{
  await db.exec('RESET ROLE');await db.query('UPDATE chart_of_accounts SET entity_id=$1 WHERE entity_id=$2',[actor,template]);await db.exec('SET ROLE authenticated');
  try {
    await assert.rejects(provision(),/Canonical financial templates/);
    assert.equal(await count('client_users','WHERE user_id=$1',[actor]),0);
  } finally {
    await db.exec('RESET ROLE');await db.query('UPDATE chart_of_accounts SET entity_id=$1 WHERE entity_id=$2',[template,actor]);await db.exec('SET ROLE authenticated');
  }
});
test('queued duplicate requests converge on one result (single embedded session, not independent-session concurrency)',async()=>{
  const results=await Promise.all([provision(),provision(),provision()]);
  assert.deepEqual(results[0],results[1]); assert.deepEqual(results[1],results[2]);
  assert.equal(await count('client_users','WHERE user_id=$1',[actor]),1);
});
test('receipt persistence failure rolls back the complete graph and permits recovery',async()=>{
  await db.exec(`RESET ROLE; CREATE FUNCTION fixture_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fixture receipt outage';END$$; CREATE TRIGGER fixture_receipt_failure BEFORE INSERT ON client_onboarding_receipts FOR EACH ROW EXECUTE FUNCTION fixture_receipt_failure(); SET ROLE authenticated;`);
  try {
    await assert.rejects(provision(),/receipt outage/);
    assert.equal(await count('entities','WHERE entity_code=$1',[actor]),0);
    assert.equal(await count('client_users','WHERE user_id=$1',[actor]),0);
  } finally {
    await db.exec('RESET ROLE; DROP TRIGGER fixture_receipt_failure ON client_onboarding_receipts; DROP FUNCTION fixture_receipt_failure(); SET ROLE authenticated');
  }
  assert.equal((await provision()).status,'provisioned');
});
test('a demoted initial Super User cannot replay obsolete authority',async()=>{
  await provision();
  await db.exec('RESET ROLE');await db.query('UPDATE client_users SET is_super_user=false WHERE user_id=$1',[actor]);await db.exec('SET ROLE authenticated');
  await assert.rejects(provision(),/administrator review/);
});
