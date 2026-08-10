import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';
import type { RelationshipEdge } from '@/lib/intelligence/relationship-types';

registerRelationshipResolver('maintenance', async (entityId: string): Promise<RelationshipEdge[]> => {
  const { data } = await supabase.from('maintenance_issues').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({
    source: entityId, target: i.id, type: 'HAS_ISSUE',
    id: i.id, entityType: 'maintenance_issue', title: i.title, href: `/maintenance/${i.id}`, status: i.status,
  }));
});
