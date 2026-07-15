// lib/property-operations/timeline/timeline.service.ts
// Property Timeline Service

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";

export interface TimelineEntry {
  id: string;
  entity_id: string;
  property_id: string;
  event_type: string;
  title: string;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  source: string;
  created_at: string;
  created_by?: string;
}

export class TimelineService {
  private supabase = supabase;

  async addEntry(entry: Omit<TimelineEntry, 'id' | 'created_at'>): Promise<ServiceResult<TimelineEntry>> {
    try {
      const { data, error } = await this.supabase
        .from('property_timeline')
        .insert({
          entity_id: entry.entity_id,
          property_id: entry.property_id,
          event_type: entry.event_type,
          title: entry.title,
          description: entry.description,
          reference_id: entry.reference_id,
          reference_type: entry.reference_type,
          source: entry.source,
          created_by: entry.created_by,
        })
        .select()
        .single();

      if (error) {
        return {
          error: { code: 'TIMELINE_ADD_FAILED', message: error.message },
        };
      }

      return { data: data as TimelineEntry };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_ADD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getByProperty(propertyId: string): Promise<ServiceResult<TimelineEntry[]>> {
    try {
      const { data, error } = await this.supabase
        .from('property_timeline')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          error: { code: 'TIMELINE_GET_FAILED', message: error.message },
        };
      }

      return { data: data as TimelineEntry[] };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getByEntity(entityId: string, limit?: number): Promise<ServiceResult<TimelineEntry[]>> {
    try {
      let query = this.supabase
        .from('property_timeline')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: { code: 'TIMELINE_GET_FAILED', message: error.message },
        };
      }

      return { data: data as TimelineEntry[] };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_GET_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const timelineService = new TimelineService();
