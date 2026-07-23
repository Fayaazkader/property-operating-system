// lib/reporting/providers/portfolio-summary.ts
import { supabase } from '@/lib/supabase';

export async function getPortfolioSummaryData(entityId: string) {
  const { data: properties } = await supabase.from('properties').select('id, property_name').eq('entity_id', entityId);
  const { data: leases } = await supabase.from('leases').select('property_id, monthly_rental, lease_status').eq('owner_entity_id', entityId);
  const { data: units } = await supabase.from('units').select('property_id, occupancy_status, scheduled_rental, properties!inner(entity_id)').eq('properties.entity_id', entityId);

  const rows: string[][] = [];
  let totalRent = 0, totalUnits = 0, totalOccupied = 0, totalVacancyLoss = 0;

  for (const prop of (properties || [])) {
    const propLeases = (leases || []).filter(l => l.property_id === prop.id);
    const activeLeases = propLeases.filter(l => l.lease_status === 'Active');
    const propRent = activeLeases.reduce((s, l) => s + (l.monthly_rental || 0), 0);
    const propUnits = (units || []).filter(u => u.property_id === prop.id);
    const occupied = propUnits.filter(u => u.occupancy_status === 'Occupied').length;
    const occupancyRate = propUnits.length > 0 ? Math.round((occupied / propUnits.length) * 100) : 0;

    // Vacancy loss from scheduled rental, not average
    const vacancyLoss = propUnits
      .filter(u => u.occupancy_status === 'Vacant')
      .reduce((s, u) => s + (u.scheduled_rental || 0), 0);

    totalRent += propRent;
    totalUnits += propUnits.length;
    totalOccupied += occupied;
    totalVacancyLoss += vacancyLoss;

    rows.push([prop.property_name, activeLeases.length.toString(), propRent.toLocaleString(), `${occupancyRate}%`, propUnits.length.toString(), occupied.toString(), vacancyLoss.toLocaleString()]);
  }

  const portfolioOccupancy = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return {
    headers: ['Property', 'Leases', 'Monthly Rent', 'Occupancy', 'Units', 'Occupied', 'Vacancy Loss'],
    rows,
    totals: ['PORTFOLIO', (leases || []).filter(l => l.lease_status === 'Active').length.toString(), totalRent.toLocaleString(), `${portfolioOccupancy}%`, totalUnits.toString(), totalOccupied.toString(), totalVacancyLoss.toLocaleString()],
  };
}
