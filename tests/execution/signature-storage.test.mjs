import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadTypeScript } from './load-typescript.mjs';
const {storeSignatureEvidence}=loadTypeScript('lib/execution/server/signature-evidence-storage.ts');
const {stageSignatureEvidence}=loadTypeScript('lib/execution/server/signature-evidence-registry.ts');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const dataUrl='data:image/png;base64,'+png.toString('base64');
const invitation={invitation_id:randomUUID(),execution_id:randomUUID(),participant_id:randomUUID(),document_version_id:randomUUID()};
function client({tamper=false,insertError=false}={}){
  const objects=new Map();const removed=[];const uploads=[];
  const storage={async upload(path,bytes,settings){assert.equal(settings.upsert,false);objects.set(path,new Uint8Array(bytes));uploads.push(path);return{error:null};},
    async download(path){const bytes=new Uint8Array(objects.get(path));if(tamper)bytes[10]^=1;return{data:new Blob([bytes]),error:null};},
    async remove(paths){removed.push(...paths);return{error:null};}};
  return {removed,uploads,
    storage:{from(){return storage;}},
    async rpc(name){assert.equal(name,'validate_execution_signing_invitation');return{data:[invitation],error:null};},
    from(table){if(table==='execution_signature_evidence')return{async insert(){return{error:insertError?new Error('Ambiguous response'):null};}};
      const query={select(){return query;},eq(){return query;},async maybeSingle(){return{data:{id:randomUUID(),verified_at:'2026-10-15T00:00:00Z',revoked_at:null,delivery_status:'accepted',channel:'email'},error:null};}};return query;},
  };
}
const refs={executionId:invitation.execution_id,participantId:invitation.participant_id,invitationId:invitation.invitation_id};
test('signature storage validates actual image and verifies stored bytes',async()=>{
  const db=client();const result=await storeSignatureEvidence(db,{...refs,dataUrl});
  assert.equal(result.contentLength,png.length);assert.equal(db.uploads.length,1);assert.equal(db.removed.length,0);
});
test('readback tampering blocks registration and cleans unregistered bytes',async()=>{
  const db=client({tamper:true});await assert.rejects(storeSignatureEvidence(db,{...refs,dataUrl}),/integrity mismatch/);
  assert.equal(db.removed.length,1);
});
test('truncated JPEG cannot become durable signature evidence',async()=>{
  const db=client();await assert.rejects(storeSignatureEvidence(db,{...refs,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}));
  assert.equal(db.uploads.length,0);
});
test('ambiguous database registration does not delete either evidence image',async()=>{
  const db=client({insertError:true});
  await assert.rejects(stageSignatureEvidence(db,{signingToken:'a'.repeat(64),verificationId:randomUUID(),dataUrl,initialsDataUrl:dataUrl}),/register signature/);
  assert.equal(db.uploads.length,2);assert.equal(db.removed.length,0);
});
test('invalid initials clean only an unregistered signature upload',async()=>{
  const db=client();
  await assert.rejects(stageSignatureEvidence(db,{signingToken:'a'.repeat(64),verificationId:randomUUID(),dataUrl,initialsDataUrl:'invalid'}));
  assert.equal(db.uploads.length,1);assert.equal(db.removed.length,1);
});
