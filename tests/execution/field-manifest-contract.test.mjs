import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadTypeScript } from './load-typescript.mjs';
const {parseExecutionFields}=loadTypeScript('lib/execution/field-manifest.ts');
const {requireCompletedSigningFields}=loadTypeScript('lib/execution/server/signing-fields.ts');
const {readExecutionJson}=loadTypeScript('lib/execution/server/request-body.ts');
const participant=randomUUID();
const fields=[{id:randomUUID(),participantId:participant,type:'signature',page:1,x:.1,y:.2,width:.3,height:.1}];
test('placement and completion contracts share exact participant field IDs',()=>{
  assert.deepEqual(parseExecutionFields(fields,2,[participant]),fields);
  assert.deepEqual(requireCompletedSigningFields(fields,[fields[0].id]),[fields[0].id]);
});
for(const [name,value] of [['missing',[]],['extra',[fields[0].id,randomUUID()]],['duplicate',[fields[0].id,fields[0].id]],['foreign',[randomUUID()]]]) {
  test(`completion rejects ${name} IDs`,()=>assert.throws(()=>requireCompletedSigningFields(fields,value)));
}
test('placement rejects non-finite geometry before transport',()=>{
  assert.throws(()=>parseExecutionFields([{...fields[0],x:NaN}],2,[participant]));
});
test('bounded reader parses only JSON objects',async()=>{
  const request=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"ok":true}'});
  assert.deepEqual(await readExecutionJson(request,100),{ok:true});
  await assert.rejects(readExecutionJson(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:'[]'}),100),/object/);
});
test('stream size gate cancels oversized body without Content-Length',async()=>{
  let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(500));},cancel(){cancelled=true;}});
  const request=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'});
  await assert.rejects(readExecutionJson(request,100),/exceeds limit/);assert.equal(cancelled,true);
});
test('declared oversized bodies are rejected before read',async()=>{
  const request=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'10000'},body:'{}'});
  await assert.rejects(readExecutionJson(request,100),/exceeds limit/);
});
test('invalid UTF-8 is rejected',async()=>{
  const request=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:new Uint8Array([0xff])});
  await assert.rejects(readExecutionJson(request,100));
});
