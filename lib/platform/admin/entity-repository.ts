import { BaseRepository } from '../shared/base-repository';
import type { Entity } from './entity-types';

const base = new BaseRepository<Entity>('entities');

export const entityRepository = {
  ...base,
  async archive(id: string) {
    await base.update(id, { is_archived: true, is_active: false } as any);
  }
};
