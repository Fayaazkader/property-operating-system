import { NextRequest, NextResponse } from 'next/server';
import { ExecutionAccessError, requireExecutionAuthority } from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { loadCommittedExecutionArtifact, requireFinalArtifactType } from '@/lib/execution/server/final-artifact-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try{
    const {id}=await context.params;
    const entityId=request.nextUrl.searchParams.get('entityId'),version=request.nextUrl.searchParams.get('documentVersionId');
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!uuid.test(id)||!entityId||!uuid.test(entityId)||!version||!uuid.test(version))throw new Error('Invalid reference');
    const authority=await requireExecutionAuthority(request.headers.get('authorization'),entityId,PERMISSIONS.LEASING.EXECUTION_VIEW);
    const {data:document,error}=await authority.serviceClient.from('execution_document_versions').select('id')
      .eq('id',version).eq('execution_id',id).eq('entity_id',entityId).maybeSingle();
    if(error||!document)throw new ExecutionAccessError(403,'Execution unavailable');
    const type=requireFinalArtifactType(request.nextUrl.searchParams.get('artifactType'));
    const bytes=await loadCommittedExecutionArtifact(authority.serviceClient,id,version,type);
    return new NextResponse(bytes.buffer,{headers:{...headers,'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="${type}.pdf"`}});
  }catch(error){return NextResponse.json({error:'Executed document unavailable.'},{status:error instanceof ExecutionAccessError?error.status:409,headers});}
}
