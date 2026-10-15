import { supabase } from '@/lib/supabase';
import { requireTransactionDate } from '@/lib/financial/transaction-date';
export interface ValidationResult {passed:boolean;isBlocking:boolean;checks:Array<{check:string;passed:boolean;message:string;blocking:boolean}>}
/** Advisory review only. The activation transaction locks and rechecks all scope
 * and overlapping date ranges. Legal-party matching never merges lease tenants.
 */
export class ValidationService {
 async validate(context:{tenantName:string;vatNumber:string;unitId:string;propertyId:string;leaseStart:string;leaseEnd:string;entityId:string}):Promise<ValidationResult>{
  const checks:ValidationResult['checks']=[];
  checks.push({check:'Lease-specific tenant',passed:true,message:'A new tenant account is created for every lease; legal-company matches are informational.',blocking:false});
  const {data:unit,error:unitError}=await supabase.from('units').select('property_id,operational_status').eq('id',context.unitId).single();
  const unitValid=!unitError&&unit?.property_id===context.propertyId&&unit.operational_status==='Active';
  checks.push({check:'Unit context',passed:unitValid,message:unitValid?'Unit belongs to the selected property and is operationally active':'Select an operationally active unit at the selected property',blocking:!unitValid});
  const {data:property,error:propertyError}=await supabase.from('properties').select('entity_id,property_status').eq('id',context.propertyId).single();
  const propertyValid=!propertyError&&property?.entity_id===context.entityId&&property.property_status?.toLowerCase()==='active';
  checks.push({check:'Property context',passed:propertyValid,message:propertyValid?'Active property belongs to the selected entity':'An active property in this entity is required',blocking:!propertyValid});
  let start='',end='';try{const normalize=(value:string)=>value.includes('/')?value.split('/').reverse().join('-'):value;start=requireTransactionDate(normalize(context.leaseStart));end=requireTransactionDate(normalize(context.leaseEnd));}catch{}
  const validDates=!!start&&!!end&&end>=start;
  checks.push({check:'Lease dates',passed:validDates,message:validDates?'Dates are valid':'Valid commencement and expiry dates are required',blocking:!validDates});
  if(validDates&&unitValid){const {data,error}=await supabase.from('leases').select('id,lease_status').eq('unit_id',context.unitId).lte('lease_start_date',end).gte('lease_end_date',start);const overlap=!!error||(data??[]).some(l=>['active','executed'].includes(String(l.lease_status).toLowerCase()));checks.push({check:'Occupancy date ranges',passed:!overlap,message:overlap?'Resolve overlapping lease dates before activation':'No overlapping lease; future commencement does not require a currently vacant unit',blocking:overlap});}
  return {passed:checks.every(c=>c.passed),isBlocking:checks.some(c=>!c.passed&&c.blocking),checks};
 }
}
export const validationService=new ValidationService();
