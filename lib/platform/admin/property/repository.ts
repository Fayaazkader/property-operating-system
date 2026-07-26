import { BaseRepository } from '../../shared/base-repository';
import type { Property } from './types';

const base = new BaseRepository<Property>('properties');

export const propertyRepository = {
  ...base,
  async archive(id: string) {
    await base.update(id, { property_status: 'Archived' } as any);
  }
};
