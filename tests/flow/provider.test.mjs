import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from '../execution/load-typescript.mjs';
const {statementIntent}=loadTypeScript('lib/flow/statement-intent.ts');
const {envelope}=loadTypeScript('lib/communications/server/whatsapp-intake.ts');
test('flagship language extracts intent without determining authority or inventing records',()=>{
 assert.deepEqual(statementIntent('Flow, send Shoprite Sandton their last six months of statements.'),{query:'Shoprite Sandton',months:6});
 assert.equal(statementIntent('send everybody everything'),null);assert.equal(statementIntent('send tenant last 99 months statements'),null);
 assert.equal(envelope({From:'whatsapp:+27821234567',Body:'Flow, send Shoprite Sandton their last six months of statements'}).kind,'flow_statement');
 assert.equal(envelope({From:'whatsapp:+27821234567',Body:'roof leak'}).kind,'maintenance');
});
test('SendGrid adapter uses actual acceptance ID, requires sender configuration, and reports unknown delivery',async()=>{
 const key=process.env.SENDGRID_API_KEY,from=process.env.SENDGRID_FROM_EMAIL;
 process.env.SENDGRID_API_KEY='synthetic-test-key';process.env.SENDGRID_FROM_EMAIL='sender@example.test';
 let response={statusCode:202,headers:{'x-message-id':'actual-provider-id'}};let failure=null;
 const {SendGridEmailProvider}=loadTypeScript('lib/communications/providers/sendgrid-email.ts',{'@sendgrid/mail':{setApiKey(){},async send(){if(failure)throw failure;return [response];}},'@/lib/platform/events/logger.service':{logger:{info(){},error(){}}}});
 try{
  const p=new SendGridEmailProvider();const params={to:'recipient@example.test',subject:'Test',text:'Test',html:'Test'};
  assert.equal((await p.send(params)).messageId,'actual-provider-id');assert.equal((await p.getStatus('actual-provider-id')).status,'unknown');
  response={statusCode:202,headers:{}};assert.equal((await p.send(params)).success,false);
  failure={code:429};assert.equal((await p.send(params)).definitiveRejection,true);
  failure={code:500};assert.equal((await p.send(params)).definitiveRejection,false);
  failure=Error('socket timeout');assert.equal((await p.send(params)).definitiveRejection,false);
  delete process.env.SENDGRID_FROM_EMAIL;assert.equal((await new SendGridEmailProvider().send(params)).definitiveRejection,true);
 }finally{if(key===undefined)delete process.env.SENDGRID_API_KEY;else process.env.SENDGRID_API_KEY=key;if(from===undefined)delete process.env.SENDGRID_FROM_EMAIL;else process.env.SENDGRID_FROM_EMAIL=from;}
});
test('legacy shared email worker does not retry uncertain acceptance or claim delivery',async()=>{
 const updates=[],logs=[];let result={channel:'email',success:false};
 const {CommunicationsWorker}=loadTypeScript('lib/communications/queue-worker.ts',{'@/lib/supabase':{supabase:{from:()=>({update:data=>({eq:async()=>updates.push(data)})})}},'./services/delivery-service':{deliver:async()=>result},'./services/audit-logger':{logCommunication:async data=>logs.push(data)},'@/lib/platform/events/logger.service':{logger:{info(){},error(){}}}});
 const worker=new CommunicationsWorker();await worker.processMessage({id:'test',channel:'email'});assert.equal(updates[0].status,'reconciliation_required');
 result={channel:'email',success:true,messageId:'actual'};await worker.processMessage({id:'test',channel:'email'});assert.equal(logs[0].status,'sent');
});

test('web route denies anonymous reads and requests from other origins before workflow execution',async()=>{
 const route=loadTypeScript('app/api/flow/statements/route.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})}})},'@/lib/flow/statements':{}});
 assert.equal((await route.GET(new Request('https://app.example.test/api/flow/statements?id=unknown'))).status,401);
 assert.equal((await route.POST(new Request('https://app.example.test/api/flow/statements',{method:'POST',headers:{Origin:'https://other.example.test'}}))).status,403);
 assert.equal((await route.POST(new Request('https://app.example.test/api/flow/statements',{method:'POST',headers:{Origin:'https://app.example.test'}}))).status,401);
});
