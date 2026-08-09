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
    const { data: issue } = await supabase.from('maintenance_issues').select('*').eq('id', issueId).single();
    const { data, error } = await supabase.from('work_orders').insert({
      entity_id: entityId, issue_id: issueId, property_id: propertyId,
      title: issue?.title || 'Work Order', description: issue?.description,
      category: issue?.category, priority: issue?.priority || 'routine', status: 'pending',
    }).select('*').single();

    if (error) throw error;
    await supabase.from('maintenance_issues').update({ status: 'in_progress' }).eq('id', issueId);

    await publish('maintenance.work_order.created', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { workOrder: data },
    });

    return data as WorkOrder;
  }

  async matchSupplier(workOrderId: string, entityId: string): Promise<string | null> {
    const { data: wo } = await supabase.from('work_orders').select('*').eq('id', workOrderId).single();
    if (!wo) return null;

    const priority = (wo as any)?.priority || 'routine';
    const bestSupplier = await supplierMatchingEngine.getBestSupplier(entityId, wo.category || 'other', priority);
    if (!bestSupplier) return null;

    await supabase.from('work_orders').update({
      supplier_id: bestSupplier.supplier_id, status: 'assigned',
    }).eq('id', workOrderId);

    await publish('maintenance.supplier.matched', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { workOrderId, supplierId: bestSupplier.supplier_id, score: bestSupplier.overall_score },
    });

    return bestSupplier.supplier_id;
  }

  async scheduleVisit(workOrderId: string, supplierId: string, scheduledAt: string): Promise<string> {
    const { data, error } = await supabase.from('supplier_visits').insert({
      work_order_id: workOrderId, supplier_id: supplierId,
      scheduled_at: scheduledAt, status: 'scheduled',
    }).select('id').single();

    if (error) throw error;
    await publish('maintenance.visit.scheduled', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { visitId: data.id, workOrderId, supplierId, scheduledAt },
    });
    return data.id;
  }

  async completeWork(workOrderId: string, visitId: string, cost: number, notes?: string): Promise<void> {
    await supabase.from('supplier_visits').update({
      status: 'completed', completed_at: new Date().toISOString(), notes,
    }).eq('id', visitId);

    await supabase.from('work_orders').update({
      status: 'completed', completed_date: new Date().toISOString().split('T')[0], supplier_cost: cost,
    }).eq('id', workOrderId);

    const { data: wo } = await supabase.from('work_orders').select('*').eq('id', workOrderId).single();
    await supabase.from('expected_supplier_invoices').insert({
      work_order_id: workOrderId, supplier_id: wo.supplier_id, entity_id: wo.entity_id,
      expected_amount: cost, expected_date: new Date().toISOString().split('T')[0], status: 'pending',
    });

    await publish('maintenance.work.completed', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: { workOrderId, visitId, cost },
    });
  }

  async requestApproval(issueId: string, entityId: string, estimatedCost: number): Promise<void> {
    await publish('approval.requested', {
      correlationId: crypto.randomUUID(), source: 'maintenance-engine', version: '1.0',
      payload: {
        entity_type: 'maintenance_issue', entity_id: issueId,
        action: 'approve_work_order', amount: estimatedCost, entityId,
        title: `Maintenance approval: R${estimatedCost.toLocaleString()}`,
      },
    });
  }
}

export const maintenanceEngine = new MaintenanceEngine();
