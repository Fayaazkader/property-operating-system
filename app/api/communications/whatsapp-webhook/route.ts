import {createClient} from '@supabase/supabase-js';
import {verifyProvider,processInbound,twiml,IntakeError} from '@/lib/communications/server/whatsapp-intake';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const params=await verifyProvider(request,{token:process.env.TWILIO_AUTH_TOKEN,account:process.env.TWILIO_ACCOUNT_SID,url:process.env.TWILIO_WHATSAPP_WEBHOOK_URL});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new IntakeError(503,'Intake storage is not configured');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return new Response(twiml(await processInbound(db,params)),{headers:{'Content-Type':'application/xml','Cache-Control':'no-store'}});
 }catch(e){return new Response(e instanceof IntakeError?e.message:'Intake temporarily unavailable',{status:e instanceof IntakeError?e.status:503,headers:{'Cache-Control':'no-store'}});}
}
