import { propertyRepository } from './property-repository';

export interface PropertyData {
  property_name: string;
  property_code?: string;
  property_type?: string;
  entity_id: string;
  address_line_1?: string;
  address_line_2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country?: string;
  postal_code?: string;
  total_gla_sqm?: number;
  number_of_units?: number;
  owner_entity_id?: string;
  managing_entity_id?: string;
}

export const propertyService = {
  async list(entityId?: string) {
    return propertyRepository.findAll(entityId);
  },

  async get(id: string) {
    return propertyRepository.findById(id);
  },

  async create(data: PropertyData) {
    return propertyRepository.create({
      ...data,
      property_code: data.property_code || 'PROP-' + Date.now().toString(36).toUpperCase(),
      property_status: 'Active',
      created_at: new Date().toISOString(),
    });
  },

  async update(id: string, data: Partial<PropertyData>) {
    await propertyRepository.update(id, data);
  },

  async archive(id: string) {
    const { canArchive, issues } = await this.canArchive(id);
    if (!canArchive) throw new Error(issues.map(i => i.label).join(', '));
    await propertyRepository.archive(id);
  },

  async canArchive(id: string): Promise<{ canArchive: boolean; issues: Array<{ code: string; count: number; label: string }> }> {
    const issues: Array<{ code: string; count: number; label: string }> = [];

    const activeLeases = await propertyRepository.countRelated('leases', 'property_id', id, { lease_status: 'Active' });
    if (activeLeases > 0) issues.push({ code: 'ACTIVE_LEASES', count: activeLeases, label: 'Active Leases' });

    const openWorkOrders = await propertyRepository.countRelated('work_orders', 'property_id', id, { status: 'open' });
    if (openWorkOrders > 0) issues.push({ code: 'OPEN_WORK_ORDERS', count: openWorkOrders, label: 'Open Work Orders' });

    const activeInspections = await propertyRepository.countRelated('inspections', 'property_id', id, { status: 'scheduled' });
    if (activeInspections > 0) issues.push({ code: 'ACTIVE_INSPECTIONS', count: activeInspections, label: 'Active Inspections' });

    return { canArchive: issues.length === 0, issues };
  }
};
