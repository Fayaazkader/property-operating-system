'use client';
import { useState } from 'react';
import { maintenanceEngine, type MaintenanceEngine } from '@/lib/maintenance/engine';
import type { WorkOrder } from '@/lib/maintenance/types';
export function PrepareWorkOrderAction({issueId,entityId,propertyId,exists,onPrepared,service=maintenanceEngine}:{issueId:string;entityId:string;propertyId:string;exists:boolean;onPrepared:(order:WorkOrder)=>void;service?:Pick<MaintenanceEngine,'createWorkOrder'>}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function prepare(){if(busy||exists)return;setBusy(true);setError('');
  try{onPrepared(await service.createWorkOrder(issueId,entityId,propertyId));}
  catch(caught){setError(caught instanceof Error?caught.message:'Unable to prepare work order. Retry to recover the existing result.');}
  finally{setBusy(false);}
 }
 return <div className="space-y-3">
  <button type="button" className="af-control bg-[var(--text-primary)] text-[var(--bg-primary)]" aria-busy={busy} disabled={busy||exists} onClick={()=>void prepare()}>{busy?'Preparing…':exists?'Work order prepared':'Prepare work order'}</button>
  <p className="text-sm text-[var(--text-secondary)]">Preparation records the job and its SLA. Expenditure approval and contractor assignment remain separate steps.</p>
  {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
  {exists&&<p role="status" className="text-sm text-[var(--text-secondary)]">Work order is available in this issue workspace.</p>}
 </div>;
}
