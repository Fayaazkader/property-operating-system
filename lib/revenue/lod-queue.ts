import { supabase } from '@/lib/supabase';
import { lodRenderer } from './lod-renderer';

export const lodQueue = {
  async queue(params: { entityId: string; tenantId: string; templateId: string; subject: string; body: string; generatedBy?: string }) {
    const { data } = await supabase.from('lod_queue').insert({
      entity_id: params.entityId, tenant_id: params.tenantId, template_id: params.templateId,
      subject: params.subject, body: params.body, status: 'queued',
      generated_by: params.generatedBy, created_at: new Date().toISOString(),
    }).select('id').single();
    return data;
  },

  async updateStatus(id: string, status: string, metadata?: Record<string, any>) {
    const update: Record<string, any> = { status, ...metadata };
    if (['emailed', 'whatsapp', 'downloaded', 'failed'].includes(status)) update.sent_at = new Date().toISOString();
    await supabase.from('lod_queue').update(update).eq('id', id);
  },

  async getHistory(entityId: string, tenantId?: string) {
    let query = supabase.from('lod_queue').select('*, templates:lod_templates(name), tenants:tenant_id(tenant_name)').eq('entity_id', entityId).order('created_at', { ascending: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data } = await query.limit(50);
    return data || [];
  },

  async regenerate(id: string) {
    const { data: original } = await supabase.from('lod_queue').select('*').eq('id', id).single();
    if (!original) throw new Error('Original LOD not found');
    const result = await lodRenderer.render(original.tenant_id, original.template_id, original.entity_id);
    return this.queue({
      entityId: original.entity_id, tenantId: original.tenant_id,
      templateId: original.template_id, subject: result.subject,
      body: result.body, generatedBy: 'regenerated',
    });
  },
};
