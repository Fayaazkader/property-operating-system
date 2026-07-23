// lib/reporting/providers/vacancy-report.ts
import { supabase } from '@/lib/supabase';

export async function getVacancyReportData(entityId: string) {
  // Single query with property join — no N+1, proper entity scoping
  const { data: units } = await supabase
    .from('units')
    .select('unit_number, property_id, occupancy_status, properties!inner(id, property_name, entity_id)')
    .eq('properties.entity_id', entityId);

  const propertyStats = new Map<string, { total: number; vacant: number; units: string[] }>();

  for (const u of (units || [])) {
    const prop = u.properties as any;
    const propName = prop?.property_name || 'Unknown';
    if (!propertyStats.has(propName)) propertyStats.set(propName, { total: 0, vacant: 0, units: [] });
    propertyStats.get(propName)!.total += 1;
    if (u.occupancy_status === 'Vacant') {
      propertyStats.get(propName)!.vacant += 1;
      propertyStats.get(propName)!.units.push(u.unit_number || '—');
    }
  }

  const rows: string[][] = [];
  for (const [prop, stats] of propertyStats) {
    const rate = stats.total > 0 ? Math.round((stats.vacant / stats.total) * 100) : 0;
    rows.push([prop, stats.total.toString(), stats.vacant.toString(), `${rate}%`, stats.units.slice(0, 5).join(', ') + (stats.units.length > 5 ? '...' : '')]);
  }

  return { headers: ['Property', 'Total Units', 'Vacant', 'Rate', 'Vacant Units'], rows, totals: [] };
}
