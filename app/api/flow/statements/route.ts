import {createClient} from '@/lib/supabase/server';
import {createClient as createService} from '@supabase/supabase-js';
import {prepareStatements,materializeStatements,approveStatements} from '@/lib/flow/statements';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
function service(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Statement preparation storage is not configured');
 return createService(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function GET(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401,headers});
 const {data,error}=await db.rpc('get_flow_statement',{p_id:new URL(request.url).searchParams.get('id')});
 if(error)return new Response('Statement action unavailable',{status:403,headers});
 return Response.json(data,{headers});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Origin rejected',{status:403,headers});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Sign in required',{status:401,headers});
 try{
  // Bound the stream before JSON parsing; do not trust Content-Length.
  const reader=request.body?.getReader();if(!reader)throw new Error('Request required');let raw='',size=0;const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error('Request too large');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  const input=JSON.parse(raw);let result;
  if(input.action==='approve')result=await approveStatements(db,service(),input.id,input.hash);
  else if(input.action==='resume'){
   const {data,error}=await db.rpc('get_flow_statement',{p_id:input.id});if(error)throw new Error('Statement action unavailable');result=await materializeStatements(service(),data);
  }else if(input.action==='prepare')result=await prepareStatements(db,service(),input);
  else throw new Error('Unsupported Flow action');
  return Response.json(result,{headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Statement action unavailable'},{status:400,headers});}
}
