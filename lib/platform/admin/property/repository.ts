import { BaseRepository } from '../../shared/base-repository';
import type { Property } from './types';

const base = new BaseRepository<Property>('properties');

export const propertyRepository = {
  findAll: base.findAll.bind(base),
  findById: base.findById.bind(base),
  create: base.create.bind(base),
  update: base.update.bind(base),
  countRelated: base.countRelated.bind(base),
  async archive(id: string) {
    await base.update(id, { property_status: 'Archived' } as any);
  }
};
