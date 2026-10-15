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
    CREATE TABLE public.test_permissions(actor uuid, entity uuid);
    CREATE FUNCTION public.has_entity_permission(uuid,uuid,text) RETURNS boolean LANGUAGE sql AS $$
      SELECT $3='leasing.execution.send' AND EXISTS(SELECT 1 FROM public.test_permissions WHERE actor=$1 AND entity=$2) $$;
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
});
test.beforeEach(async () => {
  ids = Object.fromEntries(['entity','otherEntity','actor','otherActor','opportunity','execution','version','document','pdf','tenant','landlord'].map(k => [k, randomUUID()]));
  fields = [ids.tenant, ids.landlord].map((participantId,i) => ({id:randomUUID(),participantId,type:'signature',page:1,x:.1,y:.1+i*.3,width:.3,height:.1}));
  await db.query('RESET ROLE');
  await db.query("SELECT set_config('test.actor','',false)");
  await db.query('INSERT INTO test_permissions VALUES($1,$2)', [ids.actor,ids.entity]);
  await db.query('INSERT INTO leasing_opportunities VALUES($1,$2)', [ids.opportunity,ids.entity]);
  await db.query("INSERT INTO executions(id,source_type,source_id,status,is_locked,sha_hash) VALUES($1,'leasing_opportunity',$2,'under_review',true,$3)", [ids.execution,ids.opportunity,sourceChecksum]);
  await db.query("INSERT INTO execution_document_versions(id,execution_id,version,document_url,snapshot,entity_id,document_id,document_checksum) VALUES($1,$2,1,'private','{}',$3,$4,$5)",[ids.version,ids.execution,ids.entity,ids.document,sourceChecksum]);
  await db.query('INSERT INTO documents VALUES($1,$2,$3)',[ids.document,ids.entity,sourceChecksum]);
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
      const predicates=[],order=[];let columns='*';
      const query={
        select(value){columns=value;return query;},
        eq(key,value){predicates.push([key,value]);return query;},
        order(key){order.push(key);return query;},
        async maybeSingle(){const result=await query;return {...result,data:result.data?.[0]??null};},
        then(resolve,reject){
          const sql=`SELECT ${columns} FROM ${table} WHERE ${predicates.map(([key],i)=>`${key}=$${i+1}`).join(' AND ')} ${order.length?'ORDER BY '+order.join(','):''}`;
          return db.query(sql,predicates.map(([,value])=>value)).then(result=>resolve({data:result.rows,error:null}),reject);
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
