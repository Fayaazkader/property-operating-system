import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from '../execution/load-typescript.mjs';
const {checkWorkspaceAccess,provisionInitialWorkspace}=loadTypeScript('lib/onboarding/service.ts');
const user={id:'actor',email:'verified@example.test'};
function client(identity={data:{user},error:null},membership={data:[{id:'membership'}],error:null}) {
  return {auth:{getUser:async()=>identity},from:table=>{
    assert.equal(table,'user_entity_access');
    return {select:()=>({eq:(column,value)=>{
      assert.equal(column,'user_id');assert.equal(value,user.id);
      return {limit:async()=>membership};
    }})};
  }};
}
test('verified membership allows access; empty results return onboarding state',async()=>{
  assert.equal(await checkWorkspaceAccess(client()),'allowed');
  assert.equal(await checkWorkspaceAccess(client(undefined,{data:[],error:null})),'unassigned');
});
test('membership SQL errors and network failures never allow access',async()=>{
  await assert.rejects(checkWorkspaceAccess(client(undefined,{data:null,error:{message:'database unavailable'}})),/Unable to verify workspace access/);
  const db=client(); db.from=()=>{throw new Error('network unavailable');};
  await assert.rejects(checkWorkspaceAccess(db),/network unavailable/);
});
test('missing session and invalid identity never reach membership reads',async()=>{
  assert.equal(await checkWorkspaceAccess(client({data:{user:null},error:{name:'AuthSessionMissingError'}})),'signed-out');
  assert.equal(await checkWorkspaceAccess(client({data:{user:null},error:null})),'signed-out');
  await assert.rejects(checkWorkspaceAccess(client({data:{user:null},error:{name:'AuthApiError'}})),/verify your session/);
});
const details={fullName:'Pilot',clientName:'Client',entityName:'Legal entity',entityCode:'ENT-1',roleName:'Manager'};
test('provisioning rejects unverified users, RPC errors and unconfirmed or foreign results',async()=>{
  await assert.rejects(provisionInitialWorkspace(client({data:{user:null},error:null}),details),/sign in again/);
  const db=client();db.rpc=async()=>({data:null,error:{message:'Database unavailable'}});
  await assert.rejects(provisionInitialWorkspace(db,details),/retry safely/);
  db.rpc=async()=>({data:{status:'provisioned',entity_id:'entity',user_id:'other'},error:null});
  await assert.rejects(provisionInitialWorkspace(db,details),/not confirmed/);
  db.rpc=async()=>({data:null,error:null});
  await assert.rejects(provisionInitialWorkspace(db,details),/not confirmed/);
});
