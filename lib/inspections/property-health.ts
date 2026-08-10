import { supabase } from '@/lib/supabase';

export interface PropertyHealthScore {
  property_id: string;
  property_name: string;
  overall: 'green' | 'amber' | 'red';
  inspection_score: number;
  maintenance_score: number;
  compliance_score: number;
  sla_score: number;
  details: string[];
}

export async function getPropertyHealth(entityId: string): Promise<{
  green: number; amber: number; red: number;
  properties: PropertyHealthScore[];
}> {
  const { data: properties } = await supabase.from('properties').select('id, property_name').eq('entity_id', entityId);
  if (!properties?.length) return { green: 0, amber: 0, red: 0, properties: [] };

  const scores: PropertyHealthScore[] = [];
  let green = 0, amber = 0, red = 0;

  for (const prop of properties) {
    const details: string[] = [];
    let totalScore = 0;
    let factors = 0;

    // Inspection score
    const { data: inspections } = await supabase.from('inspections').select('severity').eq('property_id', prop.id).in('status', ['completed']).order('completed_date', { ascending: false }).limit(5);
    const criticalFindings = (inspections || []).filter(i => i.severity === 'critical' || i.severity === 'high').length;
    const inspectionScore = criticalFindings === 0 ? 100 : criticalFindings <= 2 ? 70 : 40;
    totalScore += inspectionScore; factors++;
    if (criticalFindings > 0) details.push(`${criticalFindings} high-risk inspection finding${criticalFindings > 1 ? 's' : ''}`);

    // Maintenance score
    const { data: issues } = await supabase.from('maintenance_issues').select('priority, status').eq('property_id', prop.id).in('status', ['reported', 'classified', 'in_progress']);
    const emergencyIssues = (issues || []).filter(i => i.priority === 'emergency').length;
    const maintenanceScore = emergencyIssues === 0 ? 100 : emergencyIssues <= 1 ? 70 : 40;
    totalScore += maintenanceScore; factors++;
    if (emergencyIssues > 0) details.push(`${emergencyIssues} emergency maintenance issue${emergencyIssues > 1 ? 's' : ''}`);

    // SLA score
    const slaScore = 100; totalScore += slaScore; factors++;

    const avgScore = factors > 0 ? Math.round(totalScore / factors) : 100;
    const overall = avgScore >= 80 ? 'green' as const : avgScore >= 60 ? 'amber' as const : 'red' as const;
    
    if (overall === 'green') green++;
    else if (overall === 'amber') amber++;
    else red++;

    scores.push({ property_id: prop.id, property_name: prop.property_name, overall, inspection_score: inspectionScore, maintenance_score: maintenanceScore, compliance_score: 100, sla_score: slaScore, details });
  }

  return { green, amber, red, properties: scores };
}

export async function getOvernightChanges(entityId: string): Promise<string[]> {
  const changes: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  const { count: completedToday } = await supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'completed').gte('completed_date', today);
  if (completedToday && completedToday > 0) changes.push(`${completedToday} inspection${completedToday > 1 ? 's' : ''} completed today`);

  const { data: newIssues } = await supabase.from('maintenance_issues').select('priority').eq('entity_id', entityId).gte('created_at', today);
  const criticalNew = (newIssues || []).filter(i => i.priority === 'emergency').length;
  if (criticalNew > 0) changes.push(`${criticalNew} new emergenc${criticalNew > 1 ? 'ies' : 'y'} reported`);

  const { data: highRisk } = await supabase.from('inspections').select('id').eq('entity_id', entityId).in('severity', ['critical', 'high']).gte('completed_date', today);
  if (highRisk && highRisk.length > 0) changes.push(`${highRisk.length} high-risk finding${highRisk.length > 1 ? 's' : ''} recorded`);

  return changes;
}
