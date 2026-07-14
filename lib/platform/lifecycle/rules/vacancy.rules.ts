// lib/platform/lifecycle/rules/vacancy.rules.ts
// Vacancy Rules — Create vacancies from expired leases

import { LifecycleRule } from '../types';

export const vacancyRules: LifecycleRule[] = [
  {
    id: 'vacancy.lease_expired',
    name: 'Create Vacancy from Expired Lease',
    description: 'When a lease expires, automatically create a vacancy',
    domain: 'vacancy',
    priority: 1,
    enabled: true,
    conditions: [
      {
        field: 'lease_status',
        operator: 'eq',
        value: 'active',
      },
    ],
    actions: [
      {
        type: 'execute',
        target: 'vacancy.create',
        config: {
          action: 'create_vacancy',
          source: 'expired_lease',
        },
      },
      {
        type: 'publish_event',
        target: 'vacancy.automatically.created',
        config: {
          eventName: 'vacancy.automatically.created',
        },
      },
      {
        type: 'notify',
        target: 'property_manager',
        config: {
          message: 'A new vacancy has been created from an expired lease',
        },
      },
    ],
  },
];
