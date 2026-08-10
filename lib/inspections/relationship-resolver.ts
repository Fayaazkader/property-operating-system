// lib/inspections/relationship-resolver.ts
import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';

registerRelationshipResolver('inspections', async (entityId: string) => {
  const { data } = await supabase.from('inspections').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({
    source: entityId, target: i.id,
    relationship: 'has_inspection',
    id: i.id, type: 'inspection', title: i.title, href: `/inspections`, status: i.status,
  }));
});
