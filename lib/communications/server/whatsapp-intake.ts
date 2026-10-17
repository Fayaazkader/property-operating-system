import 'server-only';
import { createHash } from 'node:crypto';
import { validateRequest } from 'twilio';
import {statementIntent} from '@/lib/flow/statement-intent';
export class IntakeError extends Error { constructor(public status:number,message:string){super(message);} }
export async function verifyProvider(request:Request,config:{token?:string;account?:string;url?:string}){
 if(!config.token||!config.account||!config.url)throw new IntakeError(503,'WhatsApp receiving is not configured');
 const url=new URL(config.url);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new IntakeError(503,'Invalid provider configuration');
 if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')throw new IntakeError(415,'Expected provider form');
 const sig=request.headers.get('x-twilio-signature');if(!sig)throw new IntakeError(403,'Provider authentication failed');
 const reader=request.body?.getReader();if(!reader)throw new IntakeError(400,'Missing payload');let size=0;const parts:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();throw new IntakeError(413,'Payload too large');}parts.push(value);}}finally{reader.releaseLock();}
 const raw=Buffer.concat(parts).toString('utf8'),params:Record<string,string>=Object.create(null);
 for(const[k,v]of new URLSearchParams(raw)){if(Object.hasOwn(params,k))throw new IntakeError(400,'Duplicate provider field');params[k]=v;}
 if(!validateRequest(config.token,sig,config.url,params)||params.AccountSid!==config.account)throw new IntakeError(403,'Provider authentication failed');
 if(!/^SM[0-9a-f]{32}$/i.test(params.MessageSid??'')||!/^whatsapp:\+[1-9]\d{7,14}$/.test(params.From??''))throw new IntakeError(400,'Invalid sender or message');
 return params;
}
export function envelope(params:Record<string,string>){
 const body=(params.Body??'').trim(),phone=params.From.slice(9);
 const pair=/^CONNECT ([a-f0-9]{64})$/i.exec(body);
 if(pair)return {phone,body:'[connection code redacted]',pairingHash:createHash('sha256').update(pair[1]).digest('hex')};
 const numbered=/^SELECT ([1-9][0-9]?)$/i.exec(body);if(numbered)return {phone,body,kind:'selection',selection:Number(numbered[1])};
 const selection=/^SELECT ([a-f0-9-]{36}) ([a-f0-9-]{36})$/i.exec(body);
 if(selection)return {phone,body,kind:'selection',bindingId:selection[1],pendingId:selection[2]};
 // Media ingestion is deliberately not inferred from a provider URL: no remote fetch or attachment claim.
 if(Number(params.NumMedia??'0')>0)return {phone,body,kind:'unsupported_media'};
 const flow=statementIntent(body);if(flow)return {phone,body,kind:'flow_statement',...flow};
 const maintenance=/\b(leak|repair|broken|maintenance|burst|blocked|fault|damage|not working|no power|fire|smoke|sparking)\b/i.test(body);
 return {phone,body,kind:maintenance?'maintenance':'clarification',priority:/\b(fire|smoke|sparking|electric shock|emergency)\b/i.test(body)?'emergency':'routine'};
}
export async function processInbound(db:any,params:Record<string,string>){
 const saved=await db.rpc('receive_whatsapp_maintenance',{p_provider_id:`twilio:${params.AccountSid}:${params.MessageSid}`,p_payload:{...envelope(params),payloadHash:createHash('sha256').update(JSON.stringify(Object.entries(params).sort())).digest('hex')}});
 if(saved.error||!saved.data)throw new IntakeError(503,'Message receipt unavailable');
 const done=await db.rpc('process_whatsapp_maintenance',{p_id:saved.data});
 if(done.error||!done.data)throw new IntakeError(503,'Message processing unavailable; retry is safe');
 return done.data;
}
export function twiml(result:any){
 let message=result.message;
 if(result.status==='select_property')message+='\n'+result.choices.map((c:any,index:number)=>`${index+1}. ${c.property} — reply SELECT ${index+1}`).join('\n');
 if(result.status==='created')message+=`\nReference: ${result.workOrderId}`;
 const escaped=String(message).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
 return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}
