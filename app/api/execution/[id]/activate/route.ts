import { NextRequest, NextResponse } from 'next/server';
import { requireExecutionAuthority, ExecutionAccessError } from '@/lib/execution/server/authority';
import { readExecutionJson } from '@/lib/execution/server/request-body';
import { loadCommittedExecutionArtifact } from '@/lib/execution/server/final-artifact-access';
import { PERMISSIONS } from '@/lib/rbac/permissions';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
 const headers={'Cache-Control':'no-store'};
 try {
  const {id}=await context.params;const body=await readExecutionJson(request,2048);
  if(!UUID.test(id)||typeof body.entityId!=='string'||!UUID.test(body.entityId)||typeof body.documentVersionId!=='string'||!UUID.test(body.documentVersionId)||Object.keys(body).some(k=>!['entityId','documentVersionId'].includes(k)))throw new Error('Invalid activation request');
  const authority=await requireExecutionAuthority(request.headers.get('authorization'),body.entityId,PERMISSIONS.LEASING.ACTIVATION_EXECUTE);
  const {data:version,error}=await authority.serviceClient.from('execution_document_versions').select('id')
    .eq('execution_id',id).eq('id',body.documentVersionId).eq('entity_id',body.entityId).eq('status','active').maybeSingle();
  if(error||!version)throw new ExecutionAccessError(403,'Execution unavailable');
  // Rehash both private committed artifacts before operational activation.
  await loadCommittedExecutionArtifact(authority.serviceClient,id,version.id,'signed_pdf');
  await loadCommittedExecutionArtifact(authority.serviceClient,id,version.id,'execution_certificate');
  const {data,error:activationError}=await authority.serviceClient.rpc('activate_executed_lease',{
    p_entity_id:authority.entityId,p_execution_id:id,p_document_version_id:version.id,p_actor_id:authority.actorId,
  });
  if(activationError||!data||!UUID.test(data.lease_id??'')||!UUID.test(data.tenant_id??''))throw new Error('Activation requires recovery');
  return NextResponse.json(data,{headers});
 }catch(error){return NextResponse.json({error:'Activation could not complete. Check executed authority, unit availability and accounting configuration; existing signatures are preserved.'},{status:error instanceof ExecutionAccessError?error.status:409,headers});}
}
