import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { loadTypeScript } from './load-typescript.mjs';
const execution='11111111-1111-4111-8111-111111111111',entity='22222222-2222-4222-8222-222222222222',version='33333333-3333-4333-8333-333333333333';
function activation({tampered=false,denied=false}={}) {
 const calls=[];
 class AccessError extends Error {constructor(status,message){super(message);this.status=status;}}
 const query={select(){return this;},eq(k,v){calls.push([k,v]);return this;},async maybeSingle(){return {data:{id:version}};}};
 const service={from(){return query;},async rpc(name,args){calls.push([name,args]);return {data:{lease_id:execution,tenant_id:entity}};}};
 const {POST}=loadTypeScript('app/api/execution/[id]/activate/route.ts',{
 '@/lib/execution/server/authority':{ExecutionAccessError:AccessError,requireExecutionAuthority:async()=>{if(denied)throw new AccessError(403,'Denied');return {serviceClient:service,actorId:entity,entityId:entity};}},
 '@/lib/execution/server/final-artifact-access':{loadCommittedExecutionArtifact:async(_client,_execution,_version,kind)=>{calls.push([kind]);if(tampered)throw new Error('Hash mismatch');}},
 });
 return {calls,send:body=>POST(new NextRequest('http://localhost/api/execution/'+execution+'/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body??{entityId:entity,documentVersionId:version})}),{params:Promise.resolve({id:execution})})};
}
test('activation HTTP boundary rehashes both artifacts before scoped atomic RPC',async()=>{
 const {calls,send}=activation();const response=await send();assert.equal(response.status,200);
 assert.deepEqual(calls.filter(c=>['signed_pdf','execution_certificate','activate_executed_lease'].includes(c[0])).map(c=>c[0]),['signed_pdf','execution_certificate','activate_executed_lease']);
 assert.ok(calls.some(c=>c[0]==='entity_id'&&c[1]===entity));assert.equal(response.headers.get('cache-control'),'no-store');
});
test('activation HTTP boundary rejects tampering without invoking activation',async()=>{
 const {calls,send}=activation({tampered:true});assert.equal((await send()).status,409);assert.ok(!calls.some(c=>c[0]==='activate_executed_lease'));
});
test('activation HTTP boundary preserves authorization denial',async()=>{const {calls,send}=activation({denied:true});assert.equal((await send()).status,403);assert.deepEqual(calls,[]);});
test('activation HTTP boundary rejects client commercial terms',async()=>{const {calls,send}=activation();assert.equal((await send({entityId:entity,documentVersionId:version,rent:1})).status,409);assert.deepEqual(calls,[]);});
test('billing adapter posts only selected types and server review hash, never client amounts',async()=>{
 let captured;const {InitialBillingService}=loadTypeScript('lib/revenue/initial-billing-service.ts',{'@/lib/supabase':{supabase:{rpc:async(name,args)=>{captured={name,args};return {data:1};}}}});
 const service=new InitialBillingService();assert.equal(await service.postCharges(execution,[{charge_type:'deposit',selected:true,amount_incl_vat:1,account_id:'forged'},{charge_type:'rent',selected:false}],{entityId:entity,planSha256:'a'.repeat(64)}),1);
 assert.deepEqual(captured,{name:'post_lease_commencement_billing',args:{p_entity_id:entity,p_lease_id:execution,p_plan_sha256:'a'.repeat(64),p_selected_types:['deposit']}});
});
test('legacy invoice freezer delegates governed issuance without trusting worksheet amounts',async()=>{
 const calls=[];const query={select(){return this;},eq(k,v){calls.push([k,v]);return this;},async maybeSingle(){return {data:{commencement_payment_term_id:'term'}};},async single(){return {data:calls.some(c=>c[0]==='period_type')&&calls.filter(c=>c[0]==='id').length===1?{id:version,status:'open',period_start:'2026-10-01',period_end:'2026-10-31'}:{id:execution,property_id:entity,tenant_id:entity,active_execution_id:version,lease_start_date:'2026-10-01'}};}};
 const {freezeBilling}=loadTypeScript('lib/revenue/billing-freeze.ts',{'@/lib/supabase':{supabase:{from(table){assert.ok(['financial_periods','leases','invoices'].includes(table),'No invoice writes permitted');return query;}}},'@/lib/revenue/initial-billing-service':{initialBillingService:{async calculate(){return {planSha256:'a'.repeat(64)};},async getInvoiceTerms(){return {selectedId:'term'};},async issueInvoice(_id,args){assert.equal(args.planSha256,'a'.repeat(64));return {invoiceId:version,statementId:entity};}}},'@/lib/financial/posting-engine':{postingEngine:{}},'@/lib/revenue/payment-terms':{resolvePaymentTerms(){assert.fail('Must stop before payment terms');}}});
 const result=await freezeBilling({entityId:entity,periodId:version,periodName:'2026-10',periodStart:'2026-10-01',tenants:[{tenantId:entity,tenantName:'Test',leaseId:execution,charges:[]}]});
 assert.equal(result.results[0].posted,true);assert.equal(result.results[0].invoice_id,version);assert.ok(calls.some(c=>c[0]==='properties.entity_id'&&c[1]===entity));
});
