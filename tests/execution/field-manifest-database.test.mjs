import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { NextRequest } from 'next/server.js';
import { PDFDocument } from 'pdf-lib';
import { loadTypeScript } from './load-typescript.mjs';
const { loadCompletedSignerArtifact, loadCommittedExecutionArtifact } = loadTypeScript('lib/execution/server/final-artifact-access.ts');
const { finaliseExecution } = loadTypeScript('lib/execution/server/finalisation.ts');
import { PGlite } from '@electric-sql/pglite';

const migration = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const schema = migration('20260826131729_remote_schema');
// Use actual repository table definitions, extending only columns added later.
const table = name => schema.match(new RegExp(`CREATE TABLE "public"\\."${name}" \\([\\s\\S]*?\\n\\);`))[0];
let db, ids, fields;
let checksum; let originalPdf;
const sourceChecksum = 'b'.repeat(64);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const pngHash = createHash('sha256').update(png).digest('hex');
async function save(expected = 0, value = fields, entity = ids.entity, actor = ids.actor) {
  return (await db.query(`SELECT * FROM save_execution_field_manifest($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [entity, ids.execution, actor, ids.version, checksum, JSON.stringify(value), expected])).rows[0];
}
async function ready() {
  return db.query('SELECT * FROM mark_execution_ready_for_signing($1,$2,$3)', [ids.entity, ids.execution, ids.actor]);
}
test.before(async () => {
  const document=await PDFDocument.create();document.addPage();document.addPage();originalPdf=await document.save();checksum=createHash('sha256').update(originalPdf).digest('hex');
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('role',true) $$;
    CREATE TABLE storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE public.documents(id uuid primary key, entity_id uuid, checksum text);
    CREATE TABLE public.leasing_opportunities(id uuid primary key, entity_id uuid);
    CREATE TABLE public.test_permissions(actor uuid, entity uuid, permissions text[] NOT NULL DEFAULT ARRAY['leasing.execution.send']);
    CREATE FUNCTION public.has_entity_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS(SELECT 1 FROM public.test_permissions WHERE actor=$1 AND entity=$2 AND $3=ANY(permissions)) $$;
    ${table('executions')} ALTER TABLE executions ADD PRIMARY KEY(id);
    ${table('execution_document_versions')} ALTER TABLE execution_document_versions ADD PRIMARY KEY(id);
    ALTER TABLE execution_document_versions ADD COLUMN entity_id uuid, ADD COLUMN document_id uuid, ADD COLUMN document_checksum text;
    ${table('execution_participants')} ALTER TABLE execution_participants ADD PRIMARY KEY(id);
    ${table('execution_events')}
    CREATE UNIQUE INDEX ON execution_participants(execution_id,id);
    CREATE UNIQUE INDEX ON execution_document_versions(execution_id,id);
    ${migration('20261008140000_add_secure_execution_signing_invitations').match(/CREATE TABLE public.execution_signing_invitations \([\s\S]*?\n\);/)[0]}
    ${migration('20261008150000_add_execution_signer_verification').match(/CREATE TABLE public.execution_signer_verifications \([\s\S]*?\n\);/)[0]}
    ALTER TABLE execution_signer_verifications ADD COLUMN delivery_status text, ADD COLUMN participant_email_snapshot text;
    GRANT USAGE ON SCHEMA public,auth TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);
  await db.exec(migration('20261009150000_create_execution_signing_documents'));
  await db.exec(migration('20261013100000_govern_execution_signatories'));
  await db.exec(migration('20261009125000_create_execution_signature_evidence'));
  await db.exec(migration('20261015180000_execution_final_artifacts'));
  await db.exec(migration('20261015190000_execution_field_manifests'));
  await db.exec(migration('20261009133000_allow_execution_evidence_retries'));
  await db.exec(migration('20261009151000_require_prepared_execution_pdf'));
  await db.exec(migration('20261013110000_protect_execution_signatory_manifest'));
  await db.exec(migration('20261015200000_execution_field_completion'));
  await db.exec(migration('20261015210000_harden_execution_finalisation'));
  await db.exec(migration('20261013120000_restrict_execution_participant_writes'));
  for (const name of ['properties','units','tenants','tenant_contacts','leases','billing_rules','charges','chart_of_accounts','accounting_config','tax_config','billing_policies','financial_periods','statement_periods','financial_timeline','document_relationships','workflow_states','invoices','invoice_line_items','journals','journal_lines','general_ledger','sub_ledger_entries','statements_generated','payment_terms','permission_catalogue','suppliers','bank_accounts','posting_templates','posting_template_lines']) {
    await db.exec(table(name));
    if (['properties','units','tenants','leases','chart_of_accounts','financial_periods','charges','invoices','journal_lines','journals','payment_terms'].includes(name)) await db.exec(`ALTER TABLE ${name} ADD PRIMARY KEY(id)`);
  }
  await db.exec(`ALTER TABLE leasing_opportunities ADD COLUMN status text DEFAULT 'drafting',ADD COLUMN approved_terms_version_id uuid,
    ADD COLUMN activated_lease_id uuid,ADD COLUMN activated_tenant_id uuid,ADD COLUMN updated_at timestamptz;
    ${table('leasing_opportunity_versions')}
    ALTER TABLE leasing_opportunity_versions ADD PRIMARY KEY(id),ADD COLUMN entity_id uuid,ADD COLUMN snapshot jsonb;
    CREATE TABLE lease_generated_document_provenance(id uuid primary key,entity_id uuid,document_id uuid,opportunity_id uuid,commercial_version_id uuid,generated_checksum text);
    ALTER TABLE execution_document_versions ADD COLUMN generated_lease_provenance_id uuid;
    ALTER TABLE documents ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE documents ADD COLUMN file_name text,ADD COLUMN mime_type text,ADD COLUMN file_size_bytes integer,ADD COLUMN storage_bucket text,ADD COLUMN storage_key text,
      ADD COLUMN document_type text,ADD COLUMN status text,ADD COLUMN requires_review boolean,ADD COLUMN uploaded_by uuid;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
    GRANT USAGE ON SCHEMA auth TO authenticated;
  `);
  await db.exec(migration('20260916120000_add_bank_account_dimension_to_journal_lines').split('CREATE OR REPLACE FUNCTION')[1] ? 'CREATE OR REPLACE FUNCTION'+migration('20260916120000_add_bank_account_dimension_to_journal_lines').split('CREATE OR REPLACE FUNCTION')[1] : '');
  await db.exec('ALTER TABLE journal_lines ADD COLUMN bank_account_id uuid');
  await db.exec(migration('20260916123000_enforce_subledger_idempotency'));
  await db.exec(migration('20261015220000_govern_execution_activation'));
  await db.exec(migration('20261015230000_atomic_commencement_billing'));
  await db.exec(schema.match(/CREATE FUNCTION "public"\."prevent_invoice_edit_closed_period"\(\)[\s\S]*?\$\$;/)[0]);
  await db.exec('CREATE TRIGGER enforce_invoice_immutability BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION prevent_invoice_edit_closed_period()');
  await db.exec(`ALTER TABLE permission_catalogue ADD PRIMARY KEY(key);CREATE TABLE brokers(id uuid,entity_id uuid);
    CREATE POLICY fixture_ledger_read ON sub_ledger_entries FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM test_permissions WHERE actor=auth.uid() AND entity=entity_id));
    GRANT SELECT ON test_permissions TO authenticated;
    CREATE POLICY fixture_ledger_write ON sub_ledger_entries FOR ALL TO authenticated USING(true) WITH CHECK(true);
    GRANT INSERT,UPDATE,DELETE ON journals,journal_lines,general_ledger,sub_ledger_entries TO authenticated;`);
  await db.exec(migration('20261016000000_atomic_commencement_invoice'));
  await db.exec(migration('20261016010000_govern_financial_posting'));
  await db.exec('CREATE TRIGGER enforce_charge_period BEFORE INSERT ON charges FOR EACH ROW EXECUTE FUNCTION prevent_charge_into_closed_period()');

});
test.beforeEach(async () => {
  ids = Object.fromEntries(['entity','otherEntity','actor','otherActor','opportunity','execution','version','document','pdf','tenant','landlord'].map(k => [k, randomUUID()]));
  fields = [ids.tenant, ids.landlord].map((participantId,i) => ({id:randomUUID(),participantId,type:'signature',page:1,x:.1,y:.1+i*.3,width:.3,height:.1}));
  await db.query('RESET ROLE');
  await db.query("SELECT set_config('test.actor','',false)");
  await db.query('INSERT INTO test_permissions(actor,entity) VALUES($1,$2)', [ids.actor,ids.entity]);
  await db.query('INSERT INTO leasing_opportunities VALUES($1,$2)', [ids.opportunity,ids.entity]);
  await db.query("INSERT INTO executions(id,source_type,source_id,status,is_locked,sha_hash) VALUES($1,'leasing_opportunity',$2,'under_review',true,$3)", [ids.execution,ids.opportunity,sourceChecksum]);
  await db.query("INSERT INTO execution_document_versions(id,execution_id,version,document_url,snapshot,entity_id,document_id,document_checksum) VALUES($1,$2,1,'private','{}',$3,$4,$5)",[ids.version,ids.execution,ids.entity,ids.document,sourceChecksum]);
  await db.query('INSERT INTO documents(id,entity_id,checksum) VALUES($1,$2,$3)',[ids.document,ids.entity,sourceChecksum]);
  await db.exec("SELECT set_config('assetflow.execution_document_write','stage',false)");
  await db.query(`INSERT INTO execution_signing_documents(id,execution_id,document_version_id,entity_id,source_document_id,source_checksum,pdf_checksum,storage_path,page_count,content_length,conversion_provider)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,2,${originalPdf.length},'original-pdf')`,[ids.pdf,ids.execution,ids.version,ids.entity,ids.document,sourceChecksum,checksum,`${ids.execution}/source.pdf`]);
  await db.exec("SELECT set_config('assetflow.execution_document_write','commit',false)");
  await db.query("UPDATE execution_signing_documents SET status='committed',committed_at=now() WHERE id=$1",[ids.pdf]);
  for (const [id,kind,order] of [[ids.tenant,'tenant',1],[ids.landlord,'landlord',2]]) {
    await db.query("INSERT INTO execution_participants(id,execution_id,participant_type,name,email,signing_order) VALUES($1,$2,$3,$3,$3||'@example.invalid',$4)",[id,ids.execution,kind,order]);
  }
  await db.exec('SET ROLE service_role');
});
test.after(async () => db?.close());
test('readiness fails at database boundary without a manifest',async()=>{
  await assert.rejects(ready(),/manifest required/);
  const {rows} = await db.query('SELECT status FROM executions WHERE id=$1',[ids.execution]);
  assert.equal(rows[0].status,'under_review');
});
test('save, exact retry, freeze and audit are atomic',async()=>{
  const first=await save();
  assert.equal(first.revision,1); assert.match(first.manifest_sha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(await save(),first);
  const result=await ready(); assert.equal(result.rows[0].execution_status,'ready');
  const {rows}=await db.query('SELECT status,manifest_sha256 FROM execution_field_manifests WHERE document_version_id=$1',[ids.version]);
  assert.equal(rows[0].status,'frozen'); assert.equal(rows[0].manifest_sha256,first.manifest_sha256);
  const events=await db.query("SELECT event_type FROM execution_events WHERE execution_id=$1 AND event_type IN ('signing_fields_saved','signing_fields_frozen')",[ids.execution]);
  assert.equal(events.rows.length,2);
  await assert.rejects(save(1),/cannot edit/);
});
test('stale concurrent edit cannot overwrite a saved revision',async()=>{
  await save(); const altered=structuredClone(fields); altered[0].x=.2;
  await assert.rejects(save(0,altered),/revision conflict/);
  const next=await save(1,altered); assert.equal(next.revision,2);
});
test('entity and actor authority are enforced',async()=>{
  await assert.rejects(save(0,fields,ids.otherEntity),/permission denied/);
  await assert.rejects(save(0,fields,ids.entity,ids.otherActor),/permission denied/);
  await db.query("SELECT set_config('test.actor',$1,false)",[ids.otherActor]);
  await assert.rejects(save(),/permission denied/);
});
test('authenticated and anonymous callers have no write RPC privilege',async()=>{
  for(const role of ['authenticated','anon']) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`);
    await assert.rejects(save(),/permission denied for function/);
  }
});
test('direct manifest mutation cannot bypass command boundary',async()=>{
  await save();
  await assert.rejects(db.query("UPDATE execution_field_manifests SET fields='[]' WHERE document_version_id=$1",[ids.version]),/permission denied/);
});
for (const [label,mutate] of [
  ['duplicate IDs',f=>f[1].id=f[0].id],['unknown participant',f=>f[0].participantId=randomUUID()],
  ['missing participant',f=>f.pop()],['outside PDF',f=>f[0].page=3],['fractional page',f=>f[0].page=1.5],
  ['negative origin',f=>f[0].x=-.1],['outside rectangle',f=>f[0].width=1],
  ['zero extent',f=>f[0].height=0],['string coordinate',f=>f[0].x='0.1'],
  ['unsupported field',f=>f[0].type='text'],['missing key',f=>delete f[0].x],['extra key',f=>f[0].value='injected'],
]) test(`rejects ${label}`,async()=>{const value=structuredClone(fields);mutate(value);await assert.rejects(save(0,value));});
test('source version and PDF identity cannot change under frozen fields',async()=>{
  await save(); await ready();
  await assert.rejects(db.query('UPDATE executions SET sha_hash=$1 WHERE id=$2',['c'.repeat(64),ids.execution]),/manifest required/);
});
test('frozen manifest cannot be altered even by table owner',async()=>{
  await save();await ready();await db.exec('RESET ROLE');
  await assert.rejects(db.query("UPDATE execution_field_manifests SET fields='[]' WHERE document_version_id=$1",[ids.version]),/immutable/);
  await assert.rejects(db.query('DELETE FROM execution_field_manifests WHERE document_version_id=$1',[ids.version]),/cannot be deleted/);
});

async function signatureFixture(participant = ids.tenant, includeInitials = false) {
  const invitation = randomUUID(), verification = randomUUID(), evidence = randomUUID();
  const token = randomUUID().replaceAll('-','') + randomUUID().replaceAll('-','');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.exec('RESET ROLE');
  await db.query("UPDATE executions SET status='sent' WHERE id=$1",[ids.execution]);
  await db.query(`INSERT INTO execution_signing_invitations(id,execution_id,participant_id,token_hash,document_version_id,expires_at)
    VALUES($1,$2,$3,$4,$5,now()+interval '1 day')`,[invitation,ids.execution,participant,tokenHash,ids.version]);
  await db.query(`INSERT INTO execution_signer_verifications(id,invitation_id,code_hash,channel,destination_hash,expires_at,verified_at,delivery_status,participant_email_snapshot)
    VALUES($1,$2,$3,'email',$3,now()+interval '10 minutes',now(),'accepted',$4)`,[verification,invitation,'a'.repeat(64),participant===ids.tenant?'tenant@example.invalid':'landlord@example.invalid']);
  await db.query(`INSERT INTO execution_signature_evidence(id,execution_id,participant_id,document_version_id,invitation_id,verification_id,storage_path,content_sha256,content_type,content_length,
    initials_storage_path,initials_sha256,initials_content_type,initials_content_length)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'image/png',${png.length},$9,$10,$11,$12)`,[evidence,ids.execution,participant,ids.version,invitation,verification,`${ids.execution}/${evidence}.png`,pngHash,
      includeInitials?`${ids.execution}/${evidence}-initials.png`:null,includeInitials?'b'.repeat(64):null,includeInitials?'image/png':null,includeInitials?100:null]);
  await db.exec('SET ROLE service_role');
  return { invitation,verification,evidence,tokenHash,participant,token };
}
async function sign(fixture,hash,completed) {
  return db.query(`SELECT * FROM record_execution_participant_signature($1,$2,$3,'typed','consent-v1',null,null,null,null,$4,$5::uuid[])`,
    [fixture.tokenHash,fixture.verification,fixture.evidence,hash,completed]);
}
test('old signature RPC overload is absent', async()=>{
  const {rows} = await db.query("SELECT to_regprocedure('public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text)') AS old");
  assert.equal(rows[0].old,null);
});
test('mandatory field completion binds signature, manifest, invitation and audit',async()=>{
  const manifest=await save();await ready();
  const fixture=await signatureFixture();
  const completed=fields.filter(f=>f.participantId===ids.tenant).map(f=>f.id);
  const result=await sign(fixture,manifest.manifest_sha256,completed);
  assert.equal(result.rows[0].remaining_participants,1);
  const {rows}=await db.query('SELECT status,signature_data FROM execution_participants WHERE id=$1',[ids.tenant]);
  assert.equal(rows[0].status,'signed');assert.equal(rows[0].signature_data.manifest_sha256,manifest.manifest_sha256);
  assert.deepEqual(rows[0].signature_data.completed_field_ids,completed);
  await assert.rejects(sign(fixture,manifest.manifest_sha256,completed),/unavailable/);
});
for(const [name,change] of [
  ['missing fields',ids=>[]],['duplicate field',ids=>[ids[0],ids[0]]],['foreign field',ids=>[randomUUID()]],
]) test(`signing rejects ${name} without consuming invitation`,async()=>{
  const manifest=await save();await ready();const fixture=await signatureFixture();
  const completed=fields.filter(f=>f.participantId===ids.tenant).map(f=>f.id);
  await assert.rejects(sign(fixture,manifest.manifest_sha256,change(completed)),/incomplete/);
  const {rows}=await db.query('SELECT consumed_at FROM execution_signing_invitations WHERE id=$1',[fixture.invitation]);
  assert.equal(rows[0].consumed_at,null);
});
test('wrong manifest cannot sign',async()=>{
  await save();await ready();const fixture=await signatureFixture();
  await assert.rejects(sign(fixture,'f'.repeat(64),fields.filter(f=>f.participantId===ids.tenant).map(f=>f.id)),/manifest mismatch/);
});
test('landlord cannot sign ahead of tenant',async()=>{
  const manifest=await save();await ready();const fixture=await signatureFixture(ids.landlord);
  await assert.rejects(sign(fixture,manifest.manifest_sha256,fields.filter(f=>f.participantId===ids.landlord).map(f=>f.id)),/Earlier signatories/);
});
test('separate initials are mandatory and immutable on commit',async()=>{
  fields.push({...fields[0],id:randomUUID(),type:'initial',page:2});
  const manifest=await save();await ready();const fixture=await signatureFixture();
  const completed=fields.filter(f=>f.participantId===ids.tenant).map(f=>f.id);
  await assert.rejects(sign(fixture,manifest.manifest_sha256,completed),/initials image missing/);
  // Failed signing leaves evidence staged. Create another valid upload attempt.
  const initialsEvidence=randomUUID();
  await db.query(`INSERT INTO execution_signature_evidence(id,execution_id,participant_id,document_version_id,invitation_id,verification_id,storage_path,content_sha256,content_type,content_length,
    initials_storage_path,initials_sha256,initials_content_type,initials_content_length)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'image/png',100,$9,$8,'image/png',100)`,[initialsEvidence,ids.execution,ids.tenant,ids.version,fixture.invitation,fixture.verification,`${ids.execution}/${initialsEvidence}.png`,'a'.repeat(64),`${ids.execution}/${initialsEvidence}-initials.png`]);
  await sign({...fixture,evidence:initialsEvidence},manifest.manifest_sha256,completed);
  await assert.rejects(db.query('UPDATE execution_signature_evidence SET initials_sha256=$1 WHERE id=$2',['c'.repeat(64),initialsEvidence]),/immutable/);
});

async function fullySign() {
  const manifest=await save();await ready();
  const fixtures=[];
  for(const participant of [ids.tenant,ids.landlord]) {
    const fixture=await signatureFixture(participant);fixtures.push(fixture);
    await sign(fixture,manifest.manifest_sha256,fields.filter(f=>f.participantId===participant).map(f=>f.id));
  }
  return {...manifest,fixtures};
}
async function stageFinal(kind='signed_pdf',hash='d'.repeat(64)) {
  const path=`${ids.execution}/${ids.version}/${kind}/${hash}.pdf`;
  return (await db.query('SELECT stage_execution_final_artifact($1,$2,$3,$4,$5,100) AS id',[ids.execution,ids.version,kind,path,hash])).rows[0].id;
}
test('finalisation requires all participants and mandatory fields',async()=>{
  await save();await ready();
  await assert.rejects(stageFinal(),/not eligible/);
  await assert.rejects(db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]),/not eligible/);
});
test('final artifact stage, commit, completion and retries preserve one result',async()=>{
  await fullySign();
  const signed=await stageFinal();assert.equal(await stageFinal(),signed);
  await db.query('SELECT commit_execution_final_artifact($1)',[signed]);
  await assert.rejects(db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]),/Both final artifacts/);
  const cert=await stageFinal('execution_certificate','e'.repeat(64));
  await db.query('SELECT commit_execution_final_artifact($1)',[cert]);
  await db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]);
  await db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]);
  assert.equal(await stageFinal(),signed);
  await db.query('SELECT commit_execution_final_artifact($1)',[signed]);
  const {rows}=await db.query('SELECT status,sha_hash FROM executions WHERE id=$1',[ids.execution]);
  assert.equal(rows[0].status,'executed');assert.equal(rows[0].sha_hash,'d'.repeat(64));
  const events=await db.query("SELECT count(*)::int AS count FROM execution_events WHERE execution_id=$1 AND event_type='executed'",[ids.execution]);
  assert.equal(events.rows[0].count,1);
});
test('final artifacts cannot be silently replaced on retry',async()=>{
  await fullySign();await stageFinal();
  await assert.rejects(stageFinal('signed_pdf','f'.repeat(64)),/identity conflict/);
});
test('final storage path cannot escape execution or omit hash',async()=>{
  await fullySign();
  await assert.rejects(db.query('SELECT stage_execution_final_artifact($1,$2,$3,$4,$5,100)',[ids.execution,ids.version,'signed_pdf','../public/file.pdf','d'.repeat(64)]),/metadata/);
});
test('final artifact direct writes and internal gate are not application capabilities',async()=>{
  await fullySign();const signed=await stageFinal();
  await assert.rejects(db.query("UPDATE execution_final_artifacts SET status='committed',committed_at=now() WHERE id=$1",[signed]),/permission denied/);
  await assert.rejects(db.query('SELECT assert_execution_finalisation_context($1,$2)',[ids.execution,ids.version]),/permission denied/);
});

// Actual canonical service + actual migrated PostgreSQL functions, with only the
// external Supabase transport/storage replaced by local DB queries and byte maps.
function localClient(objects, options = {}) {
  const counts = {uploads:0,completions:0};
  const client = {
    from(table) {
      const predicates=[],order=[];let columns='*',limit=null;
      const query={
        select(value){columns=value;return query;},
        eq(key,value){predicates.push([key,value,'=']);return query;},
        lte(key,value){predicates.push([key,value,'<=']);return query;},gte(key,value){predicates.push([key,value,'>=']);return query;},
        limit(value){limit=value;return query;},
        async single(){return query.maybeSingle();},
        order(key,options){order.push(key+(options?.ascending===false?' DESC':''));return query;},
        async maybeSingle(){const result=await query;return {...result,data:result.data?.[0]??null};},
        then(resolve,reject){
          if(table==='posting_templates'&&columns.includes('lines:'))columns="*,(SELECT coalesce(jsonb_agg(t),'[]') FROM posting_template_lines t WHERE t.template_id=posting_templates.id) AS lines";
          const sql=`SELECT ${columns} FROM ${table} WHERE ${predicates.map(([key,,op],i)=>`${key}${op}$${i+1}`).join(' AND ')} ${order.length?'ORDER BY '+order.join(','):''} ${limit===null?'':'LIMIT '+limit}`;
          return db.query(sql,predicates.map(([,value])=>value)).then(result=>resolve({data:JSON.parse(JSON.stringify(result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date&&(key==='period_start'||key==='period_end'||key.endsWith('_date'))?value.toISOString().slice(0,10):value]))))),error:null}),reject);
        },
      };return query;
    },
    async rpc(name,args) {
      if(name==='complete_execution_finalisation')counts.completions++;
      try {
        const values=Object.values(args),params=Object.keys(args).map((key,i)=>`${key} => $${i+1}`);
        const result=await db.query(name==='save_execution_field_manifest'?`SELECT * FROM ${name}(${params.join(',')})`:`SELECT ${name}(${params.join(',')}) AS result`,values);
        return {data:name==='save_execution_field_manifest'?result.rows:result.rows[0].result,error:null};
      } catch(error){return {data:null,error};}
    },
    storage:{from(bucket){return {
      async upload(path,bytes,settings){
        counts.uploads++;assert.equal(settings.upsert,false);
        if(options.rejectUploads)return {error:new Error('Storage outage')};
        const key=bucket+'/'+path;
        if(objects.has(key))return {error:new Error('Already exists')};
        objects.set(key,new Uint8Array(bytes));return {error:null};
      },
      async download(path){
        const bytes=objects.get(bucket+'/'+path);
        return bytes?{data:new Blob([bytes]),error:null}:{data:null,error:new Error('Not found')};
      },
    };}},
  };
  return {client,counts};
}
async function finalisationObjects() {
  const evidence=await db.query("SELECT storage_path FROM execution_signature_evidence WHERE execution_id=$1 AND status='committed'",[ids.execution]);
  return new Map([[`execution-documents/${ids.execution}/source.pdf`,originalPdf],...evidence.rows.map(r=>['execution-evidence/'+r.storage_path,png])]);
}
test('local integration: signatures -> original-page PDF -> detached certificate -> private storage -> atomic completion -> retry',async()=>{
  await fullySign();const objects=await finalisationObjects();const {client,counts}=localClient(objects);
  const result=await finaliseExecution(client,ids.execution,ids.version);
  assert.match(result.signedPdfSha256,/^[a-f0-9]{64}$/);
  const repeated=await finaliseExecution(client,ids.execution,ids.version);
  assert.deepEqual(repeated,result);
  const rows=await db.query('SELECT artifact_type,content_sha256,storage_path FROM execution_final_artifacts WHERE execution_id=$1',[ids.execution]);
  assert.equal(rows.rows.length,2);assert.equal(counts.completions,2);
  for(const row of rows.rows){
    const bytes=objects.get('execution-documents/'+row.storage_path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.content_sha256);
    const document=await PDFDocument.load(bytes);if(row.artifact_type==='signed_pdf')assert.equal(document.getPageCount(),2);else assert.ok(document.getPageCount()>=1);
  }
});
test('storage failure cannot complete execution; exact retry recovers staged artifact',async()=>{
  await fullySign();const objects=await finalisationObjects();const failed=localClient(objects,{rejectUploads:true});
  await assert.rejects(finaliseExecution(failed.client,ids.execution,ids.version),/storage unavailable/);
  assert.equal(failed.counts.completions,0);
  const {rows}=await db.query('SELECT status FROM executions WHERE id=$1',[ids.execution]);assert.equal(rows[0].status,'partially_signed');
  await finaliseExecution(localClient(objects).client,ids.execution,ids.version);
});
test('tampered source bytes prevent any final artifact upload',async()=>{
  await fullySign();const objects=await finalisationObjects();
  const bytes=new Uint8Array(originalPdf);bytes[10]^=1;objects.set(`execution-documents/${ids.execution}/source.pdf`,bytes);
  const {client,counts}=localClient(objects);
  await assert.rejects(finaliseExecution(client,ids.execution,ids.version),/integrity mismatch/);
  assert.equal(counts.uploads,0);assert.equal(counts.completions,0);
});

test('interleaved finalisation callers converge without duplicate artifacts or completion events',async()=>{
  await fullySign();const objects=await finalisationObjects();
  const a=localClient(objects), b=localClient(objects);
  const results=await Promise.all([finaliseExecution(a.client,ids.execution,ids.version),finaliseExecution(b.client,ids.execution,ids.version)]);
  assert.deepEqual(results[0],results[1]);
  const count=await db.query('SELECT count(*)::int AS count FROM execution_final_artifacts WHERE execution_id=$1',[ids.execution]);
  assert.equal(count.rows[0].count,2);
  const events=await db.query("SELECT count(*)::int AS count FROM execution_events WHERE execution_id=$1 AND event_type='executed'",[ids.execution]);
  assert.equal(events.rows[0].count,1);
});

test('executed delivery revalidates verified signer, invitation scope, hashes and private artifact',async()=>{
  const {fixtures}=await fullySign();const objects=await finalisationObjects();const {client}=localClient(objects);
  await assert.rejects(loadCompletedSignerArtifact(client,fixtures[0].token,fixtures[0].verification,'signed_pdf'),/unavailable/);
  await finaliseExecution(client,ids.execution,ids.version);
  const bytes=await loadCompletedSignerArtifact(client,fixtures[0].token,fixtures[0].verification,'signed_pdf');
  assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
  await assert.rejects(loadCompletedSignerArtifact(client,fixtures[0].token,fixtures[1].verification,'signed_pdf'),/verification required/);
  await assert.rejects(loadCompletedSignerArtifact(client,'0'.repeat(64),fixtures[0].verification,'signed_pdf'),/unavailable/);
  const artifact=await db.query("SELECT storage_path FROM execution_final_artifacts WHERE execution_id=$1 AND artifact_type='signed_pdf'",[ids.execution]);
  const key='execution-documents/'+artifact.rows[0].storage_path;
  const tampered=new Uint8Array(objects.get(key));tampered[10]^=1;objects.set(key,tampered);
  await assert.rejects(loadCommittedExecutionArtifact(client,ids.execution,ids.version,'signed_pdf'),/integrity mismatch/);
});
test('executed delivery rejects expired invitations',async()=>{
  const {fixtures}=await fullySign();const objects=await finalisationObjects();const {client}=localClient(objects);
  await finaliseExecution(client,ids.execution,ids.version);
  await db.query("UPDATE execution_signing_invitations SET expires_at=created_at+interval '1 microsecond' WHERE id=$1",[fixtures[0].invitation]);
  await assert.rejects(loadCompletedSignerArtifact(client,fixtures[0].token,fixtures[0].verification,'execution_certificate'),/unavailable/);
});
test('executed state cannot bypass committed artifact boundary',async()=>{
  await save();await ready();
  await assert.rejects(db.query("UPDATE executions SET status='executed' WHERE id=$1",[ids.execution]),/final artifacts required/);
});

function authorizedRoute(file,client) {
  class ExecutionAccessError extends Error {constructor(status,message){super(message);this.status=status;}}
  return loadTypeScript(file,{'@/lib/execution/server/authority':{
    ExecutionAccessError,
    async requireExecutionAuthority(auth,entityId){
      if(auth!=='Bearer local-test')throw new ExecutionAccessError(401,'Unauthorized');
      return{actorId:ids.actor,entityId,serviceClient:client};
    },
  }});
}
test('field API uses actual PDF, exact entity scope and governed save transaction',async()=>{
  const objects=new Map([[`execution-documents/${ids.execution}/source.pdf`,originalPdf]]);
  const {client}=localClient(objects);const route=authorizedRoute('app/api/execution/[id]/fields/route.ts',client);
  const request=new NextRequest(`http://localhost/api/execution/${ids.execution}/fields`,{method:'POST',
    headers:{Authorization:'Bearer local-test','Content-Type':'application/json'},
    body:JSON.stringify({entityId:ids.entity,documentVersionId:ids.version,pdfSha256:checksum,expectedRevision:0,fields})});
  const response=await route.POST(request,{params:Promise.resolve({id:ids.execution})});
  assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
  const get=await route.GET(new NextRequest(`http://localhost/api/execution/${ids.execution}/fields?entityId=${ids.entity}`,{headers:{Authorization:'Bearer local-test'}}),{params:Promise.resolve({id:ids.execution})});
  assert.equal(get.status,200);assert.deepEqual((await get.json()).fields,fields);
  const foreign=await route.GET(new NextRequest(`http://localhost/api/execution/${ids.execution}/fields?entityId=${ids.otherEntity}`,{headers:{Authorization:'Bearer local-test'}}),{params:Promise.resolve({id:ids.execution})});
  assert.equal(foreign.status,403);
  const unauthenticated=await route.GET(new NextRequest(`http://localhost/api/execution/${ids.execution}/fields?entityId=${ids.entity}`),{params:Promise.resolve({id:ids.execution})});
  assert.equal(unauthenticated.status,401);
});
test('field API rejects illegible date before immutable readiness boundary',async()=>{
  const objects=new Map([[`execution-documents/${ids.execution}/source.pdf`,originalPdf]]);
  const {client}=localClient(objects);const route=authorizedRoute('app/api/execution/[id]/fields/route.ts',client);
  const invalid=[...fields,{...fields[0],id:randomUUID(),type:'date',height:.001}];
  const response=await route.POST(new NextRequest('http://localhost',{method:'POST',headers:{Authorization:'Bearer local-test','Content-Type':'application/json'},
    body:JSON.stringify({entityId:ids.entity,documentVersionId:ids.version,pdfSha256:checksum,expectedRevision:0,fields:invalid})}),{params:Promise.resolve({id:ids.execution})});
  assert.equal(response.status,409);
  const count=await db.query('SELECT count(*)::int AS count FROM execution_field_manifests WHERE execution_id=$1',[ids.execution]);
  assert.equal(count.rows[0].count,0);
});
test('manager download API enforces entity scope and returns only verified committed bytes',async()=>{
  await fullySign();const objects=await finalisationObjects();const {client}=localClient(objects);
  await finaliseExecution(client,ids.execution,ids.version);
  const route=authorizedRoute('app/api/execution/[id]/artifacts/route.ts',client);
  const context={params:Promise.resolve({id:ids.execution})};
  const url=`http://localhost/api/execution/${ids.execution}/artifacts?entityId=${ids.entity}&documentVersionId=${ids.version}&artifactType=signed_pdf`;
  assert.equal((await route.GET(new NextRequest(url),context)).status,401);
  assert.equal((await route.GET(new NextRequest(url.replace(ids.entity,ids.otherEntity),{headers:{Authorization:'Bearer local-test'}}),context)).status,403);
  const response=await route.GET(new NextRequest(url,{headers:{Authorization:'Bearer local-test'}}),context);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(),2);
});
test('audit failure rolls back executed transition while preserving committed artifacts for recovery',async()=>{
  await fullySign();const signed=await stageFinal();await db.query('SELECT commit_execution_final_artifact($1)',[signed]);
  const cert=await stageFinal('execution_certificate','e'.repeat(64));await db.query('SELECT commit_execution_final_artifact($1)',[cert]);
  await db.exec(`RESET ROLE;
    CREATE FUNCTION public.test_execution_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='executed' THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER test_execution_audit_failure BEFORE INSERT ON execution_events FOR EACH ROW EXECUTE FUNCTION test_execution_audit_failure();
    SET ROLE service_role;`);
  try {
    await assert.rejects(db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]),/Injected audit failure/);
    const {rows}=await db.query('SELECT status FROM executions WHERE id=$1',[ids.execution]);assert.equal(rows[0].status,'partially_signed');
  } finally {
    await db.exec('RESET ROLE; DROP TRIGGER test_execution_audit_failure ON execution_events; DROP FUNCTION test_execution_audit_failure(); SET ROLE service_role;');
  }
  await db.query('SELECT complete_execution_finalisation($1,$2)',[ids.execution,ids.version]);
});
test('lease manifest rollout preserves existing non-lease signature transaction defaults',async()=>{
  await db.query("UPDATE executions SET source_type='document',status='ready' WHERE id=$1",[ids.execution]);
  const fixture=await signatureFixture();
  const {rows}=await db.query("SELECT * FROM record_execution_participant_signature($1,$2,$3,'typed','consent-v1')",[fixture.tokenHash,fixture.verification,fixture.evidence]);
  assert.equal(rows[0].remaining_participants,1);
  const {loadSigningFields}=loadTypeScript('lib/execution/server/signing-fields.ts');
  const result=await loadSigningFields(localClient(new Map()).client,{execution_id:ids.execution,participant_id:ids.landlord,document_version_id:ids.version});
  assert.deepEqual(result.fields,[]);assert.equal(result.manifestSha256,null);
});

async function activationFixture(overrides={}) {
 const property=randomUUID(),unit=randomUUID(),commercial=randomUUID(),provenance=randomUUID();
 const now=new Date();const start=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-01`;
 const end=`${now.getUTCFullYear()+1}-${String(now.getUTCMonth()+1).padStart(2,'0')}-01`;
 const terms={opportunityId:ids.opportunity,prospectName:'Canonical Tenant',propertyId:property,unitId:unit,monthlyRental:10000,depositAmount:20000,
  commencementDate:start,expiryDate:end,escalationPercent:8,parkingBays:0,rentalVatTreatment:'exclusive',...overrides};
 await db.exec('RESET ROLE');
 await db.query('UPDATE test_permissions SET permissions=permissions||ARRAY[$1,$2] WHERE actor=$3 AND entity=$4',['leasing.activation.execute','leases.approve',ids.actor,ids.entity]);
 await db.query("INSERT INTO properties(id,property_name,property_code,entity_id,owner_entity_id) VALUES($1,'Canonical Property','ACT',$2,$2)",[property,ids.entity]);
 await db.query("INSERT INTO units(id,property_id,unit_number,occupancy_status,operational_status) VALUES($1,$2,'A1','Vacant','Active')",[unit,property]);
 await db.query('INSERT INTO leasing_opportunity_versions(id,opportunity_id,version_number,entity_id,snapshot) VALUES($1,$2,1,$3,$4)',[commercial,ids.opportunity,ids.entity,JSON.stringify(terms)]);
 await db.query('INSERT INTO lease_generated_document_provenance VALUES($1,$2,$3,$4,$5,$6)',[provenance,ids.entity,ids.document,ids.opportunity,commercial,sourceChecksum]);
 await db.query('UPDATE leasing_opportunities SET approved_terms_version_id=$1 WHERE id=$2',[commercial,ids.opportunity]);
 await db.query('UPDATE executions SET snapshot=$1 WHERE id=$2',[JSON.stringify({commercial_version_id:commercial}),ids.execution]);
 await db.query('UPDATE execution_document_versions SET snapshot=$1,generated_lease_provenance_id=$2 WHERE id=$3',[JSON.stringify({commercial_version_id:commercial}),provenance,ids.version]);
 for(const [role,type] of [['rental_income_commercial','income'],['deposit_liability','liability'],['recovery_utilities','income'],['fee_income','income']]){
  const account=randomUUID();await db.query('INSERT INTO chart_of_accounts(id,entity_id,gl_code,account_name,account_type,category) VALUES($1,$2,$3,$3,$4,$3)',[account,ids.entity,role,type]);
  await db.query('INSERT INTO accounting_config(entity_id,business_role,account_id) VALUES($1,$2,$3)',[ids.entity,role,account]);
 }
 for(const [code,rate] of [['VAT_STANDARD',15],['NO_VAT',0]])await db.query('INSERT INTO tax_config(entity_id,tax_code,tax_name,tax_rate) VALUES($1,$2,$2,$3)',[ids.entity,code,rate]);
 await db.exec('SET ROLE service_role');
 await fullySign();const objects=await finalisationObjects();await finaliseExecution(localClient(objects).client,ids.execution,ids.version);
 return {property,unit,commercial,provenance,terms,objects,start};
}
async function activate(actor=ids.actor,entity=ids.entity) {
 return (await db.query('SELECT activate_executed_lease($1,$2,$3,$4) AS result',[entity,ids.execution,ids.version,actor])).rows[0].result;
}
async function billingSession(fixture) {
 await db.exec('RESET ROLE');
 for(const type of ['statement','financial'])await db.query(`INSERT INTO financial_periods(entity_id,period_name,period_start,period_end,period_type) VALUES($1,$2,$3,$4,$5)`,
  [ids.entity,type+' '+fixture.start,fixture.start,fixture.terms.expiryDate,type]);
 await db.query("SELECT set_config('test.actor',$1,false)",[ids.actor]);await db.exec('SET ROLE authenticated');
}
async function preview(lease,entity=ids.entity){return (await db.query('SELECT prepare_lease_commencement_billing($1,$2) AS result',[entity,lease])).rows[0].result;}
async function postInitial(lease,plan,selected=plan.charges.map(c=>c.charge_type)){
 return (await db.query('SELECT post_lease_commencement_billing($1,$2,$3,$4) AS result',[ids.entity,lease,plan.planSha256,selected])).rows[0].result;
}
test('executed authority activates tenant, unit, rules, private document and pending billing atomically',async()=>{
 const fixture=await activationFixture();const result=await activate();const retry=await activate();
 assert.equal(result.lease_id,retry.lease_id);assert.equal(result.tenant_id,retry.tenant_id);
 const tenant=await db.query('SELECT kyc_status FROM tenants WHERE id=$1',[result.tenant_id]);assert.equal(tenant.rows[0].kyc_status,'Pending');
 const unit=await db.query('SELECT current_lease_id,occupancy_status FROM units WHERE id=$1',[fixture.unit]);assert.equal(unit.rows[0].current_lease_id,result.lease_id);assert.equal(unit.rows[0].occupancy_status,'Occupied');
 const rules=await db.query('SELECT rule_type,base_amount,vat_rate FROM billing_rules WHERE lease_id=$1 ORDER BY rule_type',[result.lease_id]);assert.equal(rules.rows.length,2);
 const deposits=await db.query('SELECT count(*)::int AS count FROM charges WHERE lease_id=$1',[result.lease_id]);assert.equal(deposits.rows[0].count,0);
 const events=await db.query("SELECT count(*)::int AS count FROM execution_events WHERE execution_id=$1 AND event_type='lease_activated'",[ids.execution]);assert.equal(events.rows[0].count,1);
});
test('activation requires exact entity and explicit capability',async()=>{
 await activationFixture();await assert.rejects(activate(ids.otherActor),/permission denied/);await assert.rejects(activate(ids.actor,ids.otherEntity),/permission denied/);
});
test('activation rejects changed commercial authority',async()=>{
 await activationFixture();await db.exec('RESET ROLE');await db.query('UPDATE leasing_opportunities SET approved_terms_version_id=$1 WHERE id=$2',[randomUUID(),ids.opportunity]);await db.exec('SET ROLE service_role');
 await assert.rejects(activate(),/commercial authority mismatch/);
});
test('missing entity accounting configuration rolls back activation',async()=>{
 await activationFixture();await db.exec('RESET ROLE');await db.query("DELETE FROM accounting_config WHERE entity_id=$1 AND business_role='deposit_liability'",[ids.entity]);await db.exec('SET ROLE service_role');
 await assert.rejects(activate(),/account mapping/);const count=await db.query('SELECT count(*)::int AS count FROM leases WHERE active_execution_id=$1',[ids.execution]);assert.equal(count.rows[0].count,0);
});
test('parking without a signed price fails safely instead of inventing a rate',async()=>{
 await activationFixture({parkingBays:2});await assert.rejects(activate(),/explicit parking price/);
});
test('activated contractual terms cannot be edited outside governed amendment',async()=>{
 await activationFixture();const result=await activate();await db.exec('RESET ROLE');await assert.rejects(db.query('UPDATE leases SET monthly_rental=1 WHERE id=$1',[result.lease_id]),/governed amendment/);
});
test('commencement review preserves explicit inclusive VAT and zero fees; approval posts exactly once',async()=>{
 const fixture=await activationFixture({monthlyRental:11500,rentalVatTreatment:'inclusive'});const result=await activate();await billingSession(fixture);
 const plan=await preview(result.lease_id);assert.equal(plan.charges.length,2);const rent=plan.charges.find(c=>c.charge_type==='rent');
 assert.equal(rent.amount_excl_vat,10000);assert.equal(rent.vat_amount,1500);assert.equal(rent.amount_incl_vat,11500);assert.equal(plan.policy.lease_fee_amount,0);
 assert.equal(await postInitial(result.lease_id,plan),2);assert.equal(await postInitial(result.lease_id,plan),0);
 const charges=await db.query('SELECT amount_incl_vat,vat_amount FROM charges WHERE lease_id=$1',[result.lease_id]);assert.equal(charges.rows.length,2);
});
test('tax-free lease and deposit remain tax-free',async()=>{
 const fixture=await activationFixture({rentalVatTreatment:'not_applicable'});const result=await activate();await billingSession(fixture);
 const plan=await preview(result.lease_id);assert.equal(plan.charges.every(c=>c.vat_amount===0),true);
});
test('changed review hash cannot post any charges',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 await assert.rejects(postInitial(result.lease_id,{...plan,planSha256:'f'.repeat(64)}),/stale/);
 const count=await db.query('SELECT count(*)::int AS count FROM charges WHERE lease_id=$1',[result.lease_id]);assert.equal(count.rows[0].count,0);
});
test('closed period prevents commencement posting without partial writes',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE entity_id=$1 AND period_type='financial'",[ids.entity]);await db.exec('SET ROLE authenticated');
 await assert.rejects(postInitial(result.lease_id,plan),/do not permit billing/);
});
test('duplicate or foreign charge selections are rejected',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 await assert.rejects(postInitial(result.lease_id,plan,['rent','rent']),/unique/);await assert.rejects(postInitial(result.lease_id,plan,['injected']),/Unknown/);
});
test('commencement posting permission and entity are enforced',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);
 await assert.rejects(preview(result.lease_id,ids.otherEntity),/permission denied/);
 await db.query("SELECT set_config('test.actor',$1,false)",[ids.otherActor]);await assert.rejects(preview(result.lease_id),/permission denied/);
});

 test('legacy closed period is entity scoped and still blocks its own entity',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO statement_periods(entity_id,period_name,period_start,period_end,status) SELECT $1,period_name,period_start,period_end,'closed' FROM financial_periods WHERE entity_id=$2 AND period_type='statement'",[ids.otherEntity,ids.entity]);
 await db.exec('SET ROLE authenticated');assert.equal(await postInitial(result.lease_id,plan),2);
 });
 test('own legacy closed period rolls back all commencement charges',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO statement_periods(entity_id,period_name,period_start,period_end,status) SELECT entity_id,period_name,period_start,period_end,'locked' FROM financial_periods WHERE entity_id=$1 AND period_type='statement'",[ids.entity]);
 await db.exec('SET ROLE authenticated');await assert.rejects(postInitial(result.lease_id,plan),/closed statement/);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM charges WHERE lease_id=$1',[result.lease_id])).rows[0].n,0);
 });

test('reopening a committed review recovers its selected authority after configuration changes',async()=>{
 const fixture=await activationFixture();const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);
 assert.equal(await postInitial(result.lease_id,plan,['rent']),1);
 await db.exec('RESET ROLE');await db.query("UPDATE tax_config SET tax_rate=20 WHERE entity_id=$1 AND tax_code='VAT_STANDARD'",[ids.entity]);await db.exec('SET ROLE authenticated');
 const reopened=await preview(result.lease_id);assert.equal(reopened.status,'posted');assert.equal(reopened.planSha256,plan.planSha256);
 assert.deepEqual(reopened.charges.filter(c=>c.selected).map(c=>c.charge_type),['rent']);assert.equal(await postInitial(result.lease_id,reopened,['rent']),0);
});

async function invoiceFixture(overrides={},approve=true) {
 const fixture=await activationFixture(overrides);const result=await activate();await billingSession(fixture);const plan=await preview(result.lease_id);if(approve)await postInitial(result.lease_id,plan);
 await db.exec('RESET ROLE');
 for(const [role,type] of [['ar_control','asset'],['vat_output','liability']]){
  const account=randomUUID();await db.query('INSERT INTO chart_of_accounts(id,entity_id,gl_code,account_name,account_type,category) VALUES($1,$2,$3,$3,$4,$3)',[account,ids.entity,role,type]);await db.query('INSERT INTO accounting_config(entity_id,business_role,account_id) VALUES($1,$2,$3)',[ids.entity,role,account]);
 }
 const term=randomUUID();await db.query('INSERT INTO payment_terms(id,term_name,days) VALUES($1,$2,0)',[term,'Due on commencement '+term]);await db.exec('SET ROLE authenticated');
 return {fixture,result,plan,term};
}
async function issueInvoice(f,entity=ids.entity,term=f.term){return (await db.query('SELECT issue_lease_commencement_invoice($1,$2,$3,$4) result',[entity,f.result.lease_id,f.plan.planSha256,term])).rows[0].result;}

test('full local lease lifecycle reaches issued invoice, liability, output VAT and tenant receivable atomically',async()=>{
 const f=await invoiceFixture();const issued=await issueInvoice(f);const retry=await issueInvoice(f);assert.equal(retry.invoiceId,issued.invoiceId);assert.equal(retry.replayed,true);
 await db.exec('RESET ROLE');const inv=(await db.query('SELECT * FROM invoices WHERE id=$1',[issued.invoiceId])).rows[0];assert.equal(inv.invoice_status,'issued');assert.equal(Number(inv.total_amount),31500);assert.equal(Number(inv.vat_amount),1500);assert.deepEqual(inv.due_date,inv.invoice_date);
 const postings=await db.query('SELECT a.gl_code,sum(g.debit_amount)::numeric debit,sum(g.credit_amount)::numeric credit FROM general_ledger g JOIN chart_of_accounts a ON a.id=g.account_id JOIN journal_lines jl ON jl.id=g.journal_line_id JOIN journals j ON j.id=jl.journal_id WHERE j.source_id=$1 GROUP BY a.gl_code',[issued.invoiceId]);
 const map=Object.fromEntries(postings.rows.map(r=>[r.gl_code,r]));assert.equal(Number(map.deposit_liability.credit),20000);assert.equal(Number(map.rental_income_commercial.credit),10000);assert.equal(Number(map.vat_output.credit),1500);assert.equal(Number(map.ar_control.debit),31500);
 const led=(await db.query("SELECT * FROM sub_ledger_entries WHERE entity_id=$1 AND ledger_type='tenant' AND tenant_id=$2",[ids.entity,f.result.tenant_id])).rows;assert.equal(led.length,1);assert.equal(Number(led[0].running_balance),31500);
 assert.equal((await db.query('SELECT count(*)::int n FROM invoice_line_items WHERE invoice_id=$1',[issued.invoiceId])).rows[0].n,2);
 assert.equal((await db.query("SELECT status FROM workflow_states WHERE reference_id=$1 AND workflow_type='lease_activation'",[f.result.lease_id])).rows[0].status,'completed');
});
test('invoice rejects absent terms and unauthorized entity without partial documents',async()=>{
 const f=await invoiceFixture();await assert.rejects(issueInvoice(f,ids.otherEntity),/permission denied/);await assert.rejects(issueInvoice(f,ids.entity,randomUUID()),/payment terms/);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM invoices WHERE lease_id=$1',[f.result.lease_id])).rows[0].n,0);
});
test('missing output VAT configuration rolls back invoice and all financial records',async()=>{
 const f=await invoiceFixture();await db.exec('RESET ROLE');await db.query("DELETE FROM accounting_config WHERE entity_id=$1 AND business_role='vat_output'",[ids.entity]);await db.exec('SET ROLE authenticated');await assert.rejects(issueInvoice(f),/output VAT/);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM invoices WHERE lease_id=$1',[f.result.lease_id])).rows[0].n,0);
});
test('invoice audit failure rolls back invoice, journal, GL and tenant ledger; retry recovers',async()=>{
 const f=await invoiceFixture();await db.exec('RESET ROLE');await db.exec("CREATE FUNCTION reject_invoice_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='invoice_issued' THEN RAISE EXCEPTION 'Invoice audit unavailable'; END IF;RETURN NEW;END $$; CREATE TRIGGER reject_invoice_audit BEFORE INSERT ON financial_timeline FOR EACH ROW EXECUTE FUNCTION reject_invoice_audit()");
 await db.exec('SET ROLE authenticated');await assert.rejects(issueInvoice(f),/audit unavailable/);await db.exec('RESET ROLE');for(const [table,column,value] of [['invoices','lease_id',f.result.lease_id],['journal_lines','lease_id',f.result.lease_id],['sub_ledger_entries','lease_id',f.result.lease_id]])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${column}=$1`,[value])).rows[0].n,0);
 await db.exec('DROP TRIGGER reject_invoice_audit ON financial_timeline;DROP FUNCTION reject_invoice_audit();SET ROLE authenticated');assert.ok((await issueInvoice(f)).invoiceId);
});
test('period closure blocks new issuance but allows exact committed recovery',async()=>{
 const f=await invoiceFixture();await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE entity_id=$1",[ids.entity]);await db.exec('SET ROLE authenticated');await assert.rejects(issueInvoice(f),/do not permit issuance/);
 await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='open',workflow_phase='open' WHERE entity_id=$1",[ids.entity]);await db.exec('SET ROLE authenticated');const done=await issueInvoice(f);await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE entity_id=$1",[ids.entity]);await db.exec('SET ROLE authenticated');assert.equal((await issueInvoice(f)).invoiceId,done.invoiceId);
});
test('inclusive rent and tax-free contracts issue exact totals without taxing deposit',async()=>{
 const f=await invoiceFixture({monthlyRental:11500,rentalVatTreatment:'inclusive'});const done=await issueInvoice(f);const invoice=(await db.query('SELECT total_amount,vat_amount FROM invoices WHERE id=$1',[done.invoiceId])).rows[0];assert.equal(Number(invoice.total_amount),31500);assert.equal(Number(invoice.vat_amount),1500);
});
test('approved commencement charges cannot be edited or deleted',async()=>{
 const f=await invoiceFixture();await db.exec('RESET ROLE');await assert.rejects(db.query('UPDATE charges SET amount_excl_vat=1 WHERE lease_id=$1',[f.result.lease_id]),/governed reversal/);await assert.rejects(db.query('DELETE FROM charges WHERE lease_id=$1',[f.result.lease_id]),/governed reversal/);
});
test('public generic journal RPC cannot forge a governed invoice posting',async()=>{await assert.rejects(db.query("SELECT atomic_post_journal('{\"source_event\":\"lease_commencement_invoice\"}','[]')"),/governed invoice/);});

test('canonical TypeScript billing and tenant report run through real RPC transactions after signing and PDF finalisation',async()=>{
 const f=await invoiceFixture({},false);const {client}=localClient(f.fixture.objects);
 const {InitialBillingService}=loadTypeScript('lib/revenue/initial-billing-service.ts',{'@/lib/supabase':{supabase:client}});const service=new InitialBillingService();
 const calculated=await service.calculate(f.result.lease_id,ids.entity);const approved=await service.approve(calculated);
 assert.equal(await service.postCharges(f.result.lease_id,approved.charges,{entityId:ids.entity,planSha256:approved.planSha256}),2);
 const terms=await service.getInvoiceTerms(f.result.lease_id,ids.entity);assert.ok(terms.options.some(t=>t.id===f.term&&t.days===0));
 const issued=await service.issueInvoice(f.result.lease_id,{entityId:ids.entity,planSha256:approved.planSha256,paymentTermId:f.term});
 assert.equal((await service.issueInvoice(f.result.lease_id,{entityId:ids.entity,planSha256:approved.planSha256,paymentTermId:f.term})).invoiceId,issued.invoiceId);
 const {getTenantLedgerData}=loadTypeScript('lib/reporting/providers/tenant-ledger.ts',{'@/lib/supabase':{supabase:client}});const report=await getTenantLedgerData(ids.entity,f.result.tenant_id);
 assert.equal(report.rows.length,1);assert.equal(report.rows[0][1],issued.invoiceId);assert.match(report.rows[0][6],/31.?500/);
});

async function sharedJournalFixture(){
 const f=await invoiceFixture();await db.exec('RESET ROLE');await db.query("UPDATE test_permissions SET permissions=permissions||ARRAY['finance.journal.post'] WHERE actor=$1 AND entity=$2",[ids.actor,ids.entity]);
 const accounts=(await db.query("SELECT business_role,account_id FROM accounting_config WHERE entity_id=$1",[ids.entity])).rows;const roles=Object.fromEntries(accounts.map(r=>[r.business_role,r.account_id]));
 const period=(await db.query("SELECT id FROM financial_periods WHERE entity_id=$1 AND period_type='financial'",[ids.entity])).rows[0].id;
 await db.exec('SET ROLE authenticated');
 const journal={id:randomUUID(),entity_id:ids.entity,journal_number:randomUUID(),journal_type:'general_journal',period_id:period,source_event:'tenant_adjustment',source_id:randomUUID(),created_by:'forged'};
 const lines=[{id:randomUUID(),account_id:roles.ar_control,debit_amount:100,credit_amount:0,entity_id:ids.entity,tenant_id:f.result.tenant_id,lease_id:f.result.lease_id,property_id:f.fixture.property},{id:randomUUID(),account_id:roles.rental_income_commercial,debit_amount:0,credit_amount:100,entity_id:ids.entity,tenant_id:f.result.tenant_id,lease_id:f.result.lease_id,property_id:f.fixture.property}];return {f,journal,lines};
}
async function postShared(f){return (await db.query('SELECT atomic_post_journal($1,$2) id',[JSON.stringify(f.journal),JSON.stringify(f.lines)])).rows[0].id;}
test('shared posting commits only AR tenant movement and recovers exact replay once',async()=>{
 const f=await sharedJournalFixture();const id=await postShared(f);assert.equal(await postShared({...f,journal:{...f.journal,id:randomUUID()},lines:[...f.lines].reverse().map(l=>({...l,id:randomUUID()}))}),id);
 const ledger=(await db.query('SELECT running_balance FROM sub_ledger_entries WHERE tenant_id=$1',[f.f.result.tenant_id])).rows;assert.equal(ledger.length,1);assert.equal(Number(ledger[0].running_balance),100);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT created_by FROM journals WHERE id=$1',[id])).rows[0].created_by,ids.actor);
});
test('shared posting rejects missing capability, foreign dimensions and unbalanced cents',async()=>{
 const f=await sharedJournalFixture();await db.query("SELECT set_config('test.actor',$1,false)",[ids.otherActor]);await assert.rejects(postShared(f),/permission denied/);await db.query("SELECT set_config('test.actor',$1,false)",[ids.actor]);
 f.lines[1].credit_amount=99;await assert.rejects(postShared(f),/not balanced/);f.lines[1].credit_amount=100;f.lines[0].tenant_id=randomUUID();await assert.rejects(postShared(f),/tenant entity/);
 f.lines[0].tenant_id=f.f.result.tenant_id;f.lines[0].account_id=randomUUID();await assert.rejects(postShared(f),/account entity/);
});
test('shared posting rejects changed replay and closed periods without adding journals',async()=>{
 const f=await sharedJournalFixture();await postShared(f);f.lines[0].debit_amount=200;f.lines[1].credit_amount=200;await assert.rejects(postShared(f),/replay differs/);
 await db.exec('RESET ROLE');await db.query("UPDATE financial_periods SET status='closed',workflow_phase='closed' WHERE id=$1",[f.journal.period_id]);await db.exec('SET ROLE authenticated');
 f.journal.source_id=randomUUID();f.journal.id=randomUUID();await assert.rejects(postShared(f),/Open entity financial period/);
});
test('browser roles cannot write around canonical journal or tenant ledger commands',async()=>{
 const f=await sharedJournalFixture();for(const table of ['journals','journal_lines','general_ledger'])await assert.rejects(db.query(`DELETE FROM ${table} WHERE false`),/permission denied/);
 await assert.rejects(db.query("INSERT INTO sub_ledger_entries(entity_id,ledger_type,tenant_id,debit_amount) VALUES($1,'tenant',$2,999)",[ids.entity,f.f.result.tenant_id]),/row-level security/);
});
test('actual PostingEngine, configured rules and atomic RPC integrate tenant balance without duplicate projections',async()=>{
 const f=await sharedJournalFixture();await db.exec('RESET ROLE');const template=randomUUID();
 await db.query('INSERT INTO posting_templates(id,entity_id,business_event) VALUES($1,$2,$3)',[template,ids.entity,'test_rental']);
 for(const [direction,role,formula,vat] of [['debit','ar_control','{{amount_plus_vat}}','non_vatable'],['credit','rental_income_commercial','{{amount}}','non_vatable'],['credit','vat_output','{{vat}}','standard']])await db.query('INSERT INTO posting_template_lines(template_id,sequence,direction,account_resolver,amount_formula,vat_treatment) VALUES($1,1,$2,$3,$4,$5)',[template,direction,role,formula,vat]);
 await db.query("UPDATE tax_config SET tax_rate=12 WHERE entity_id=$1 AND tax_code='VAT_STANDARD'",[ids.entity]);await db.exec('SET ROLE authenticated');
 const {client}=localClient(f.f.fixture.objects);const logger={debug(){},info(){},warn(){},error(){}};
 const {PostingEngine}=loadTypeScript('lib/financial/posting-engine.ts',{'@/lib/supabase':{supabase:client},'../platform/events/event-bus':{publish:async()=>{}},'../platform/events/logger.service':{logger},'./timeline-engine':{financialTimelineEngine:{recordJournalLifecycle:async()=>{}}}});
 const event={business_event:'test_rental',entity_id:ids.entity,source_engine:'integration-test',amount:100,vat_treatment:'standard',effective_date:f.f.fixture.start,occurred_at:f.f.fixture.start,dimensions:{tenant_id:f.f.result.tenant_id,property_id:f.f.fixture.property,lease_id:f.f.result.lease_id},metadata:{source_id:randomUUID()}};
 const engine=new PostingEngine();const result=await engine.post(event);assert.equal((await engine.post(event)).journal.id,result.journal.id);
 const ledger=(await db.query("SELECT debit_amount,running_balance FROM sub_ledger_entries WHERE tenant_id=$1 AND ledger_type='tenant'",[f.f.result.tenant_id])).rows;
 assert.equal(ledger.length,1);assert.equal(Number(ledger[0].running_balance),112);
});
test('governed invoice evidence cannot be rewritten or augmented through browser CRUD grants',async()=>{
 const f=await invoiceFixture();const done=await issueInvoice(f);await db.exec('RESET ROLE');await db.exec('GRANT INSERT,UPDATE,DELETE ON invoices,invoice_line_items,charges TO authenticated');await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('DELETE FROM invoices WHERE id=$1',[done.invoiceId]),/governed invoice/);
 await assert.rejects(db.query('UPDATE invoice_line_items SET amount=1 WHERE invoice_id=$1',[done.invoiceId]),/immutable/);
 await assert.rejects(db.query("INSERT INTO invoice_line_items(invoice_id,description,amount) VALUES($1,'forged line',999)",[done.invoiceId]),/immutable/);
 await assert.rejects(db.query("INSERT INTO charges(entity_id,source_type) VALUES($1,'lease_commencement')",[ids.entity]),/governed commencement/);
});
