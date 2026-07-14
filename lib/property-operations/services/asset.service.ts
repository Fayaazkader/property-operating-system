// lib/property-operations/services/asset.service.ts
// Asset Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { assetRepository } from '../repositories/asset.repository';
import { CreateAssetParams, UpdateAssetParams, Asset, AssetTimelineEntry } from '../types';

export class AssetService {
  private repository = assetRepository;

  async create(params: CreateAssetParams, entityId: string): Promise<ServiceResult<Asset>> {
    // Calculate next service date
    let nextServiceDate = null;
    if (params.installation_date && params.service_interval_days) {
      const date = new Date(params.installation_date);
      date.setDate(date.getDate() + params.service_interval_days);
      nextServiceDate = date.toISOString().split('T')[0];
    }

    const result = await this.repository.create({
      entity_id: entityId,
      property_id: params.property_id,
      building_id: params.building_id,
      floor: params.floor,
      zone: params.zone,
      space: params.space,
      name: params.name,
      type: params.type,
      serial_number: params.serial_number,
      model: params.model,
      manufacturer: params.manufacturer,
      installation_date: params.installation_date,
      warranty_expiry: params.warranty_expiry,
      expected_life_years: params.expected_life_years,
      replacement_value: params.replacement_value,
      service_interval_days: params.service_interval_days,
      next_service_date: nextServiceDate,
      preferred_supplier_id: params.preferred_supplier_id,
      location_notes: params.location_notes,
      status: 'commissioned' as const,
    });

    if (result.data && params.installation_date) {
      // Add timeline entry
      await this.repository.addTimelineEntry(result.data.id, {
        event: 'commissioned',
        description: `Asset "${params.name}" commissioned`,
        created_by: entityId,
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<Asset>> {
    const result = await this.repository.findById(id);
    if (result.data) {
      const timeline = await this.repository.getTimeline(id);
      result.data.timeline = timeline.data || [];
    }
    return result;
  }

  async listByProperty(propertyId: string): Promise<ServiceResult<Asset[]>> {
    return this.repository.findByProperty(propertyId);
  }

  async list(entityId: string): Promise<ServiceResult<Asset[]>> {
    return this.repository.findByEntity(entityId);
  }

  async update(id: string, params: UpdateAssetParams): Promise<ServiceResult<Asset>> {
    // If service_interval_days changed, recalculate next_service_date
    let updateData: any = { ...params };
    
    if (params.service_interval_days !== undefined) {
      const current = await this.repository.findById(id);
      if (current.data) {
        const baseDate = params.last_service_date || current.data.last_service_date || current.data.installation_date;
        if (baseDate) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() + params.service_interval_days);
          updateData.next_service_date = date.toISOString().split('T')[0];
        }
      }
    }

    return this.repository.update(id, updateData);
  }

  async recordService(id: string, serviceDate: string, notes?: string): Promise<ServiceResult<Asset>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' },
      };
    }

    // Calculate next service date
    let nextServiceDate = null;
    if (current.data.service_interval_days) {
      const date = new Date(serviceDate);
      date.setDate(date.getDate() + current.data.service_interval_days);
      nextServiceDate = date.toISOString().split('T')[0];
    }

    const result = await this.repository.update(id, {
      last_service_date: serviceDate,
      next_service_date: nextServiceDate,
      service_notes: notes || current.data.service_notes,
      status: 'operational',
    });

    if (result.data) {
      await this.repository.addTimelineEntry(id, {
        event: 'serviced',
        description: `Asset serviced${notes ? `: ${notes}` : ''}`,
        created_by: 'system',
      });
    }

    return result;
  }

  async updateStatus(id: string, status: Asset['status'], reason?: string): Promise<ServiceResult<Asset>> {
    const result = await this.repository.update(id, { status });

    if (result.data) {
      await this.repository.addTimelineEntry(id, {
        event: status,
        description: `Status changed to ${status}${reason ? `: ${reason}` : ''}`,
        created_by: 'system',
      });
    }

    return result;
  }
}

export const assetService = new AssetService();
