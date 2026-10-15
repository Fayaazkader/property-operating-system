import { NextRequest, NextResponse } from 'next/server';
import { executionServiceClient } from '@/lib/execution/server/verification-api';
import { readExecutionJson } from '@/lib/execution/server/request-body';
import { loadCompletedSignerArtifact, requireFinalArtifactType } from '@/lib/execution/server/final-artifact-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: NextRequest) {
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  if(process.env.EXECUTION_PUBLIC_SIGNING_ENABLED!=='true'||process.env.EXECUTION_EMAIL_OTP_ENABLED!=='true')return NextResponse.json({error:'Signing unavailable'},{status:503,headers});
  try{
    const body=await readExecutionJson(request,2048);
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.verificationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.verificationId))throw new Error('Invalid reference');
    const type=requireFinalArtifactType(body.artifactType);
    const bytes=await loadCompletedSignerArtifact(executionServiceClient(),body.token,body.verificationId,type);
    return new NextResponse(bytes.buffer,{headers:{...headers,'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="${type}.pdf"`}});
  }catch{return NextResponse.json({error:'Completed document is not yet available or access has expired.'},{status:409,headers});}
}
