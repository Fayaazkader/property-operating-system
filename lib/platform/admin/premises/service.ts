import { premisesRepository } from './repository';
import { premisesValidators } from './validators';
import type { UnitData, ArchiveIssue } from './types';

export const premisesService = {
  async list(propertyId?: string) {
    if (propertyId) return premisesRepository.findByProperty(propertyId);
    return premisesRepository.findAll();
  },

  async get(id: string) {
    return premisesRepository.findById(id);
  },

  async create(data: UnitData) {
    const existingUnits = await premisesRepository.findByProperty(data.property_id);
    const propertyGLA = await premisesRepository.getPropertyGLA(data.property_id);
    const existingGLA = await premisesRepository.getTotalGLA(existingUnits);

    const errors = premisesValidators.validateAll(data, propertyGLA, existingGLA, existingUnits);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return premisesRepository.create({
      ...data,
      unit_code: 'UNIT-' + Date.now().toString(36).toUpperCase(),
      occupancy_status: data.occupancy_status || 'Vacant',
      operational_status: data.operational_status || 'Active',
      created_at: new Date().toISOString(),
    });
  },

  async update(id: string, data: Partial<UnitData>) {
    // current_tenant_name is maintained by the lease service, never edited directly
    // current_tenant_name is on Unit, not UnitData — maintained by LeaseService
    await premisesRepository.update(id, data);
  },

  async archive(id: string) {
    const { canArchive, issues } = await this.canArchive(id);
    if (!canArchive) throw new Error(issues.map(i => i.label).join(', '));
    await premisesRepository.archive(id);
  },

  async canArchive(id: string): Promise<{ canArchive: boolean; issues: ArchiveIssue[] }> {
    const issues: ArchiveIssue[] = [];

    const unit = await premisesRepository.findById(id);
    if (unit?.current_lease_id) {
      issues.push({ code: 'ACTIVE_LEASE', count: 1, label: 'Active lease exists' });
    }

    if (unit?.occupancy_status === 'Occupied') {
      issues.push({ code: 'OCCUPIED', count: 1, label: 'Unit is currently occupied' });
    }

    const openWorkOrders = await premisesRepository.countRelated('work_orders', 'unit_id', id, { status: 'open' });
    if (openWorkOrders > 0) issues.push({ code: 'OPEN_WORK_ORDERS', count: openWorkOrders, label: 'Open Work Orders' });

    const scheduledInspections = await premisesRepository.countRelated('inspections', 'unit_id', id, { status: 'scheduled' });
    if (scheduledInspections > 0) issues.push({ code: 'SCHEDULED_INSPECTIONS', count: scheduledInspections, label: 'Scheduled Inspections' });

    return { canArchive: issues.length === 0, issues };
  }
};
