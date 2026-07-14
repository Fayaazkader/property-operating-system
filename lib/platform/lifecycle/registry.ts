// lib/platform/lifecycle/registry.ts
// Job Registry — All scheduled jobs

import { scheduler } from './scheduler';
import { runVacancyJob } from './jobs/vacancy.job';

// Register all jobs
scheduler.register({
  id: 'vacancy.creation',
  name: 'Vacancy Creation',
  description: 'Creates vacancies from expired leases',
  schedule: '0 6 * * *', // Daily at 6am
  handler: runVacancyJob,
  enabled: true,
});

// Future jobs:
// scheduler.register({
//   id: 'renewal.reminder',
//   name: 'Renewal Reminder',
//   description: 'Sends renewal reminders for expiring leases',
//   schedule: '0 7 * * *',
//   handler: runRenewalJob,
//   enabled: true,
// });

export { scheduler };
