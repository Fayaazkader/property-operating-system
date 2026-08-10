import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';
import type { RelationshipEdge } from '@/lib/intelligence/relationship-types';

registerRelationshipResolver('inspections', async (entityId: string): Promise<RelationshipEdge[]> => {
  const { data } = await supabase.from('inspections').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({
    source: entityId, target: i.id, type: 'HAS_INSPECTION',
    id: i.id, entityType: 'inspection', title: i.title, href: `/inspections`, status: i.status,
  }));
});
