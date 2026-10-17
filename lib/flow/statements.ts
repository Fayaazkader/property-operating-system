import 'server-only';
import {createHash} from 'node:crypto';
import {renderPDF} from '@/lib/reporting/renderers/pdf';
import {buildReportLayout} from '@/lib/reporting/layout/engine';
import {deliver} from '@/lib/communications/services/delivery-service';
import {statementIntent} from './statement-intent';

function money(value: unknown): string {
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('Issued statement contains an invalid monetary value');
 // Preserve the issued decimal representation; do not recalculate balances.
 return String(value);
}
function field(value:unknown):string { if(typeof value!=='string'||value.length>2000)throw new Error('Issued statement contains an unsupported text field');return value; }
export async function statementManifest(snapshot:any){
 const attachments=[];
 for(const doc of snapshot.documents){
  const data=doc.data;
  if(!Array.isArray(data.posted_lines))throw new Error('Issued ledger snapshot unavailable');
  const rows=data.posted_lines.map((line:any)=>[field(line.date),field(line.reference),field(line.description),money(line.debit),money(line.credit),money(line.balance)]);
  rows.unshift(['','','Opening balance','','',money(data.opening_balance)]);
  rows.push(['','','Closing balance','','',money(data.closing_balance)]);
  const layout=buildReportLayout({companyName:field(snapshot.company),reportTitle:`Statement — ${field(snapshot.tenant)}`,orientation:'portrait',period:`${doc.start} to ${doc.end}`,sections:[{title:`${field(snapshot.property)} · issued statement ${doc.id} · version ${doc.version}`,headers:['Date','Reference','Description','Debit','Credit','Balance'],rows}]});
  const content=Buffer.from(await (await renderPDF(layout)).arrayBuffer());
  attachments.push({statement_id:doc.id,filename:`statement-${doc.start}-${doc.id}.pdf`,type:'application/pdf',content:content.toString('base64'),sha256:createHash('sha256').update(content).digest('hex')});
 }
 const periods=snapshot.documents.map((d:any)=>`${d.start} to ${d.end}`).join('; ');
 return {recipient:snapshot.recipient,subject:`Account statements — ${snapshot.tenant}`,body:`Dear ${snapshot.tenant},\n\nPlease find attached your issued account statements for ${periods}.\n\nPlease contact your property management team if you have any questions.\n\nKind regards,\n${snapshot.company}`,attachments};
}
async function rpc(db:any,name:string,args:any){const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message);return data;}
export async function prepareStatements(db:any,service:any,input:any){
 const intent=statementIntent(input.instruction??'');if(!intent)throw new Error('Please specify a tenant/property and one to twelve months of statements, for example: Send [tenant] [property] their last six months of statements.');
 const action=await rpc(db,'prepare_flow_statements',{p_key:input.key,p_instruction:input.instruction,p_query:intent.query,p_months:intent.months,p_entity:input.entityId??null,p_property:input.propertyId??null,p_tenant:input.tenantId??null});
 return materializeStatements(service,action);
}
export async function materializeStatements(service:any,action:any){
 if(action.status!=='preparing')return action;
 const manifest=await statementManifest(action.snapshot);
 return rpc(service,'stage_flow_statement',{p_id:action.id,p_snapshot:action.snapshot,p_manifest:manifest});
}
export async function approveStatements(db:any,service:any,id:string,hash:string){
 // A known missing configuration is detected before claiming, so no uncertain send.
 if(!process.env.SENDGRID_API_KEY||!process.env.SENDGRID_FROM_EMAIL)throw new Error('Email provider and approved sender must be configured before approval');
 const action=await rpc(db,'claim_flow_statement',{p_id:id,p_hash:hash});
 if(!action.attempt_token)return action; // replay never calls the provider again
 let outcome='reconciliation_required',providerId:null|string=null,error:null|string='Provider outcome unknown; do not resend without reconciliation';
 try{
  const result=await deliver({channel:'email',recipient:action.manifest.recipient,subject:action.manifest.subject,body:escapeHTML(action.manifest.body).replace(/\n/g,'<br>'),attachments:action.manifest.attachments.map((a:any)=>({filename:a.filename,type:a.type,content:a.content}))});
  if(result.success&&result.messageId){outcome='submitted';providerId=result.messageId;error=null;}
  else if(result.definitiveRejection){outcome='failed';error='Provider rejected submission. Review configuration before retrying.';}
 }catch{ /* A timeout is not evidence that no email was accepted. */ }
 await rpc(service,'finish_flow_statement',{p_id:id,p_token:action.attempt_token,p_outcome:outcome,p_provider_id:providerId,p_error:error});
 return {id,status:outcome,providerId,message:outcome==='submitted'?'Email accepted by the provider. Delivery is not yet confirmed.':error};
}
function escapeHTML(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
