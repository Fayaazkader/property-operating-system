// lib/intelligence/search/property.ts
// Property Operations Search Integration

import { supabase } from "@/lib/supabase";

export interface PropertySearchResult {
  id: string;
  type: 'work_order' | 'asset' | 'inspection' | 'supplier' | 'compliance';
  title: string;
  subtitle: string;
  status: string;
  date: string;
  href: string;
}

export async function searchProperty(entityId: string, query: string): Promise<PropertySearchResult[]> {
  const results: PropertySearchResult[] = [];

  try {
    // Search Work Orders
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('id, title, description, status, created_at, property_id')
      .eq('entity_id', entityId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(3);

    if (workOrders) {
      for (const w of workOrders) {
        results.push({
          id: w.id,
          type: 'work_order',
          title: w.title || 'Work Order',
          subtitle: w.description || 'No description',
          status: w.status || 'pending',
          date: w.created_at || new Date().toISOString(),
          href: `/property-operations/work-orders/${w.id}`,
        });
      }
    }

    // Search Suppliers
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, contact_person, status, created_at')
      .eq('entity_id', entityId)
      .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%`)
      .limit(3);

    if (suppliers) {
      for (const s of suppliers) {
        results.push({
          id: s.id,
          type: 'supplier',
          title: s.name || 'Supplier',
          subtitle: s.contact_person ? `Contact: ${s.contact_person}` : 'No contact',
          status: s.status || 'active',
          date: s.created_at || new Date().toISOString(),
          href: `/property-operations/suppliers/${s.id}`,
        });
      }
    }

    // Search Assets
    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, type, status, created_at')
      .eq('entity_id', entityId)
      .or(`name.ilike.%${query}%,type.ilike.%${query}%`)
      .limit(3);

    if (assets) {
      for (const a of assets) {
        results.push({
          id: a.id,
          type: 'asset',
          title: a.name || 'Asset',
          subtitle: `Type: ${a.type || 'Unknown'}`,
          status: a.status || 'active',
          date: a.created_at || new Date().toISOString(),
          href: `/property-operations/assets/${a.id}`,
        });
      }
    }

    // Sort by date
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return results;
  } catch (error) {
    console.error('Property search error:', error);
    return [];
  }
}
