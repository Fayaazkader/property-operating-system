// lib/property-operations/timeline/timeline.service.ts
// Property Timeline Service

import { supabase } from "@/lib/supabase";
import { ServiceResult } from "@/lib/platform/types";
import { PropertyTimelineEntry } from '../types';

export class TimelineService {
  private supabase = supabase;

  async addEntry(entry: Omit<PropertyTimelineEntry, 'id' | 'created_at'>): Promise<ServiceResult<PropertyTimelineEntry>> {
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

      return { data: data as PropertyTimelineEntry };
    } catch (error) {
      return {
        error: {
          code: 'TIMELINE_ADD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getByProperty(propertyId: string): Promise<ServiceResult<PropertyTimelineEntry[]>> {
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

      return { data: data as PropertyTimelineEntry[] };
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
