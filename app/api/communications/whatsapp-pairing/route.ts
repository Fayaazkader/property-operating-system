import {randomBytes,createHash} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Origin rejected',{status:403});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401});
 try{
  const input=await request.json();const code=randomBytes(32).toString('hex');
  const {data,error}=await db.rpc('start_whatsapp_pairing',{p_entity:input.entityId,p_property:input.propertyId,p_phone:input.phone,p_hash:createHash('sha256').update(code).digest('hex')});
  if(error)return new Response('Pairing denied. Check your property and maintenance authority.',{status:403});
  return Response.json({bindingId:data,message:`CONNECT ${code}`,expiresInSeconds:600},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Invalid pairing request',{status:400});}
}
