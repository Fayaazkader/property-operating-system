import { readExecutionJson } from '@/lib/execution/server/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { ExecutionAccessError, requireExecutionAuthority } from '@/lib/execution/server/authority';
import { finaliseExecution } from '@/lib/execution/server/finalisation';
import { PERMISSIONS } from '@/lib/rbac/permissions';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control':'no-store' };
  try {
    const { id } = await context.params;
    const body = await readExecutionJson(request,2048);
    if (!UUID.test(id) || typeof body.entityId !== 'string' || !UUID.test(body.entityId) || typeof body.documentVersionId !== 'string' || !UUID.test(body.documentVersionId)) throw new Error('Invalid reference');
    const authority = await requireExecutionAuthority(request.headers.get('authorization'),body.entityId,PERMISSIONS.LEASING.EXECUTION_SEND);
    const { data: version, error } = await authority.serviceClient.from('execution_document_versions').select('id')
      .eq('id',body.documentVersionId).eq('execution_id',id).eq('entity_id',authority.entityId).eq('status','active').maybeSingle();
    if (error || !version) throw new ExecutionAccessError(403,'Execution unavailable');
    const result = await finaliseExecution(authority.serviceClient,id,version.id);
    return NextResponse.json(result,{headers});
  } catch (error) {
    return NextResponse.json({error:'Finalisation requires recovery. Existing signatures are preserved.'},{status:error instanceof ExecutionAccessError?error.status:409,headers});
  }
}
