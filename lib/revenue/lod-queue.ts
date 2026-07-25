import { supabase } from '@/lib/supabase';

export const lodQueue = {
  async queue(params: {
    entityId: string; tenantId: string; templateId: string;
    subject: string; body: string; generatedBy?: string;
  }) {
    const { data } = await supabase.from('lod_queue').insert({
      entity_id: params.entityId, tenant_id: params.tenantId,
      template_id: params.templateId, subject: params.subject,
      body: params.body, status: 'queued', created_at: new Date().toISOString(),
    }).select('id').single();
    return data;
  },

  async updateStatus(id: string, status: string, metadata?: Record<string, any>) {
    await supabase.from('lod_queue').update({ status, ...metadata, sent_at: new Date().toISOString() }).eq('id', id);
  },

  async getHistory(entityId: string, tenantId?: string) {
    let query = supabase.from('lod_queue').select('*, templates:lod_templates(name)').eq('entity_id', entityId).order('created_at', { ascending: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data } = await query.limit(50);
    return data || [];
  },
};
