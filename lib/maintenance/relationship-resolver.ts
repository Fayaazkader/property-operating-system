// lib/maintenance/relationship-resolver.ts
import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';

registerRelationshipResolver('maintenance', async (entityId: string) => {
  const { data } = await supabase.from('maintenance_issues').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({
    source: entityId, target: i.id,
    relationship: 'has_issue',
    id: i.id, type: 'maintenance_issue', title: i.title, href: `/maintenance/${i.id}`, status: i.status,
  }));
});
