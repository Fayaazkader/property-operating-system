import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { Inspection, CreateInspectionParams, UpdateInspectionParams } from '@/lib/property-operations/inspections/inspection.types';

export class InspectionsEngine {

  async create(params: CreateInspectionParams & { entity_id: string; created_by?: string }): Promise<Inspection> {
    const { data, error } = await supabase.from('inspections').insert({
      entity_id: params.entity_id, property_id: params.property_id,
      asset_id: params.asset_id, unit_id: params.unit_id,
      title: params.title, type: params.type || 'routine',
      scheduled_date: params.scheduled_date, inspector: params.inspector,
      inspector_company: params.inspector_company,
      checklist: params.checklist || [], status: 'scheduled',
      created_by: params.created_by,
    }).select('*').single();

    if (error) throw error;

    await publish('inspection.scheduled', {
      correlationId: crypto.randomUUID(), source: 'inspections-engine', version: '1.0',
      payload: { inspection: data },
    });

    return data as Inspection;
  }

  async complete(inspectionId: string, params: UpdateInspectionParams): Promise<void> {
    await supabase.from('inspections').update({
      ...params, status: 'completed', completed_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', inspectionId);

    await publish('inspection.completed', {
      correlationId: crypto.randomUUID(), source: 'inspections-engine', version: '1.0',
      payload: { inspectionId, severity: params.severity, findings: params.findings },
    });
  }

  async getUpcoming(entityId: string): Promise<Inspection[]> {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('entity_id', entityId)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .limit(20);
    return (data || []) as Inspection[];
  }

  async getOverdue(entityId: string): Promise<Inspection[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('entity_id', entityId)
      .eq('status', 'scheduled')
      .lt('scheduled_date', today);
    return (data || []) as Inspection[];
  }

  async getHistory(entityId: string, limit = 50): Promise<Inspection[]> {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('entity_id', entityId)
      .in('status', ['completed', 'cancelled'])
      .order('completed_date', { ascending: false })
      .limit(limit);
    return (data || []) as Inspection[];
  }

  async getByProperty(entityId: string, propertyId: string): Promise<Inspection[]> {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('entity_id', entityId)
      .eq('property_id', propertyId)
      .order('scheduled_date', { ascending: false })
      .limit(30);
    return (data || []) as Inspection[];
  }
}

export const inspectionsEngine = new InspectionsEngine();
