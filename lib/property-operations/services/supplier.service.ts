// lib/property-operations/services/supplier.service.ts
// Supplier Service — Business Logic Layer

import { ServiceResult } from "@/lib/platform/types";
import { supplierRepository } from '../repositories/supplier.repository';
import { CreateSupplierParams, UpdateSupplierParams, Supplier } from '../suppliers/supplier.types';
import { publish } from '@/lib/platform/events';

export class SupplierService {
  private repository = supplierRepository;

  async create(params: CreateSupplierParams, entityId: string): Promise<ServiceResult<Supplier>> {
    const result = await this.repository.create({
      entity_id: entityId,
      name: params.name,
      registration_number: params.registration_number,
      vat_number: params.vat_number,
      contact_person: params.contact_person,
      email: params.email,
      phone: params.phone,
      whatsapp_number: params.whatsapp_number,
      address: params.address,
      categories: params.categories || [],
      payment_terms_days: params.payment_terms_days || 30,
      status: 'active',
    });

    if (result.data) {
      await publish('supplier.created', {
        correlationId: result.data.id,
        source: 'supplier-service',
        version: '1.0',
        entity: {
          id: result.data.id,
          type: 'supplier',
        },
        payload: {
          supplierId: result.data.id,
          name: result.data.name,
        },
      });
    }

    return result;
  }

  async get(id: string): Promise<ServiceResult<Supplier>> {
    return this.repository.findById(id);
  }

  async list(entityId: string, options?: { status?: string; category?: string }): Promise<ServiceResult<Supplier[]>> {
    return this.repository.findByEntity(entityId, options);
  }

  async update(id: string, params: UpdateSupplierParams): Promise<ServiceResult<Supplier>> {
    return this.repository.update(id, params);
  }

  async verifyInsurance(id: string): Promise<ServiceResult<Supplier>> {
    return this.repository.update(id, {
      insurance_verified: true,
      insurance_expiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    });
  }

  async verifyFICA(id: string): Promise<ServiceResult<Supplier>> {
    return this.repository.update(id, {
      fica_verified: true,
      fica_verified_at: new Date().toISOString(),
    });
  }

  async updatePerformance(id: string, rating: number, completed: boolean): Promise<ServiceResult<Supplier>> {
    const current = await this.repository.findById(id);
    if (!current.data) {
      return {
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' },
      };
    }

    const newJobs = current.data.jobs_completed + (completed ? 1 : 0);
    const newRating = (current.data.rating * current.data.jobs_completed + rating) / (current.data.jobs_completed + 1);

    return this.repository.update(id, {
      jobs_completed: newJobs,
      rating: Math.round(newRating * 10) / 10,
    });
  }
}

export const supplierService = new SupplierService();
