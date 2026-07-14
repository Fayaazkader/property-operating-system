// lib/platform/lifecycle/scheduler.ts
// Job Scheduler — Infrastructure

import { logger } from "@/lib/platform/events/logger.service";
import { ScheduledJob, JobResult } from './types';

export class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();

  register(job: ScheduledJob): void {
    this.jobs.set(job.id, job);
    logger.info(`📋 Job registered: ${job.name}`, { jobId: job.id, schedule: job.schedule });
  }

  getJob(id: string): ScheduledJob | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  async runJob(id: string): Promise<JobResult> {
    const job = this.jobs.get(id);
    if (!job) {
      return {
        success: false,
        processed: 0,
        created: 0,
        failed: 0,
        errors: [`Job ${id} not found`],
      };
    }

    if (!job.enabled) {
      return {
        success: true,
        processed: 0,
        created: 0,
        failed: 0,
        metadata: { message: `Job ${job.name} is disabled` },
      };
    }

    logger.info(`▶️ Running job: ${job.name}`, { jobId: job.id });

    try {
      const result = await job.handler();
      logger.info(`✅ Job completed: ${job.name}`, { jobId: job.id, result });
      return result;
    } catch (error) {
      logger.error(`❌ Job failed: ${job.name}`, { jobId: job.id, error });
      return {
        success: false,
        processed: 0,
        created: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async runAll(): Promise<JobResult[]> {
    const results: JobResult[] = [];
    for (const [id, job] of this.jobs) {
      if (job.enabled) {
        const result = await this.runJob(id);
        results.push(result);
      }
    }
    return results;
  }
}

export const scheduler = new Scheduler();
