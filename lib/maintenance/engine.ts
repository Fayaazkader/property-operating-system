import { workOrderService } from '@/lib/property-operations/services/work-order.service';
import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { supplierMatchingEngine } from './supplier-matching';
import type { MaintenanceIssue, WorkOrder, EntryChannel } from './types';

export class MaintenanceEngine {

  async createIssue(params: {
    entity_id: string; property_id: string; title: string;
    description?: string; category?: string; priority?: string;
    reported_via?: EntryChannel; reported_by?: string;
    tenant_id?: string; lease_id?: string; unit_id?: string; photo_urls?: string[];
  }): Promise<MaintenanceIssue> {
    const { data: existing } = await supabase
      .from('maintenance_issues')
      .select('id, title')
      .eq('property_id', params.property_id)
      .eq('status', 'reported')
      .ilike('title', `%${params.title}%`)
      .limit(3);

    const { data, error } = await supabase.from('maintenance_issues').insert({
      entity_id: params.entity_id, property_id: params.property_id,
      unit_id: params.unit_id, tenant_id: params.tenant_id, lease_id: params.lease_id,
      reported_by: params.reported_by, reported_via: params.reported_via || 'manual',
      title: params.title, description: params.description,
      category: params.category || 'other', priority: params.priority || 'routine',
      status: 'reported', photo_urls: params.photo_urls || [],
    }).select('*').single();

    if (error) throw error;
    const issue = data as MaintenanceIssue;

    await publish('maintenance.issue.reported', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { issue, possibleDuplicates: existing || [] },
    });

    return issue;
  }

  async classifyIssue(issueId: string, category: string, priority: string, landlordResponsibility: boolean): Promise<void> {
    await supabase.from('maintenance_issues').update({
      category, priority,
      landlord_responsibility: landlordResponsibility,
      tenant_approval_required: !landlordResponsibility,
      status: 'classified', updated_at: new Date().toISOString(),
    }).eq('id', issueId);

    await publish('maintenance.issue.classified', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { issueId, category, priority, landlordResponsibility },
    });
  }

  async createWorkOrder(issueId: string, entityId: string, propertyId: string): Promise<WorkOrder> {
    const result=await workOrderService.prepareFromIssue(issueId,entityId,propertyId);
    if(result.error||!result.data)throw new Error(result.error?.message||'Work order preparation unavailable');
    return result.data;
  }

  async matchSupplier(workOrderId: string, entityId: string): Promise<string | null> {
    const { data: wo } = await supabase.from('work_orders').select('*').eq('id', workOrderId).single();
    if (!wo || wo.entity_id !== entityId) throw new Error('Work order entity mismatch');

    const priority = (wo as any)?.priority || 'routine';
    const bestSupplier = await supplierMatchingEngine.getBestSupplier(entityId, wo.category || 'other', priority);
    if (!bestSupplier) return null;

    // Matching is advisory. Only the governed quotation/authorization command assigns work.
    return bestSupplier.supplier_id;
  }

  async scheduleVisit(_workOrderId: string, _supplierId: string, _scheduledAt: string): Promise<string> {
    throw new Error('Use WorkOrderService.commandLifecycle with an authorized order, version and stable request ID to schedule a visit.');
  }

  async completeWork(_workOrderId: string, _visitId: string, _cost: number, _notes?: string): Promise<void> {
    throw new Error('Use the governed progress, completion and independent certification commands.');
  }

  async requestApproval(_issueId: string, _entityId: string, _estimatedCost: number): Promise<void> {
    throw new Error('Submit a documented quotation through the work order workspace for configured approval authority.');
  }
}
export const maintenanceEngine = new MaintenanceEngine();
