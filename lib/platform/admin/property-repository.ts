import { BaseRepository } from '../shared/base-repository';

export interface Property {
  id: string;
  property_code?: string;
  property_name: string;
  property_type?: string;
  property_status?: string;
  entity_id: string;
  address_line_1?: string;
  city?: string;
  province?: string;
  total_gla_sqm?: number;
  number_of_units?: number;
  owner_entity_id?: string;
  managing_entity_id?: string;
  created_at: string;
  updated_at: string;
}

const base = new BaseRepository<Property>('properties');

export const propertyRepository = {
  ...base,
  async archive(id: string) {
    await base.update(id, { property_status: 'Archived' } as any);
  }
};
