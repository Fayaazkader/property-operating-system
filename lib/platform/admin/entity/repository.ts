import { BaseRepository } from '../../shared/base-repository';
import type { Entity } from './types';

const base = new BaseRepository<Entity>('entities');

export const entityRepository = {
  findAll: base.findAll.bind(base),
  findById: base.findById.bind(base),
  create: base.create.bind(base),
  update: base.update.bind(base),
  countRelated: base.countRelated.bind(base),
  async archive(id: string) {
    await base.update(id, { is_archived: true, is_active: false } as any);
  }
};
