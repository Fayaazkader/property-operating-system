import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeaseTemplate,
  LeaseTemplateCategory,
  LeaseTemplateField,
} from './types';
import { Client } from 'twilio/lib/base/BaseTwilio';

export interface CreateLeaseTemplateInput {
  entityId: string;
  templateName: string;
  category: LeaseTemplateCategory;
  propertyIds?: string[];
  appliesToPropertyTypes: string[];
  createdBy?: string;
}

export interface UpdateLeaseTemplateInput {
  templateName?: string;
  category?: LeaseTemplateCategory;
  propertyIds?: string[];
  appliesToPropertyTypes?: string[];
  fields?: LeaseTemplateField[];
  fieldMapping?: unknown[];
  aiSuggestions?: unknown[];
  clauseSuggestions?: unknown[];
}

export const leaseTemplateService = {
  async createDraft(
    input: CreateLeaseTemplateInput,
    client: SupabaseClient,
  ): Promise<LeaseTemplate> {
    const { data, error } = await client.rpc(
      'create_lease_template_draft',
      {
        p_entity_id: input.entityId,
        p_template_name: input.templateName,
        p_category: input.category,
        p_applies_to_property_types: input.appliesToPropertyTypes,
        p_property_ids: input.propertyIds ?? [],
      },
    );

    if (error) throw error;
    if (!data) {
      throw new Error('Lease-template draft creation returned no template.');
    }

    return data as LeaseTemplate;
  },

  async update(
    templateId: string,
    entityId: string,
    input: UpdateLeaseTemplateInput,
    client: SupabaseClient,
  ): Promise<LeaseTemplate> {
    if (
      input.fields !== undefined ||
      input.fieldMapping !== undefined ||
      input.aiSuggestions !== undefined ||
      input.clauseSuggestions !== undefined
    ) {
      throw new Error(
        'Document fields and mappings require the governed review workflow.',
      );
    }

    const { data, error } = await client.rpc(
      'update_lease_template_draft_metadata',
      {
        p_template_id: templateId,
        p_entity_id: entityId,
        p_template_name: input.templateName ?? null,
        p_category: input.category ?? null,
        p_property_ids: input.propertyIds ?? null,
        p_applies_to_property_types:
          input.appliesToPropertyTypes ?? null,
      },
    );

    if (error) throw error;
    if (!data) {
      throw new Error('Draft metadata update returned no template.');
    }

    return data as LeaseTemplate;
  },

  // Source documents must be attached through the authenticated
  // upload API. Approval must use the strict approval API.

  async archive(
    templateId: string,
    entityId: string,
    client: SupabaseClient,
  ): Promise<void> {
    const { error } = await client.rpc(
      'archive_lease_template',
      {
        p_template_id: templateId,
        p_entity_id: entityId,
      },
    );

    if (error) throw error;
  },

  async getForReview(
  templateId: string,
  entityId: string,
  client: SupabaseClient
): Promise<LeaseTemplate | null> {
  const { data, error } = await client
  .from('lease_templates')
  .select('*')
  .eq('id', templateId)
  .eq('entity_id', entityId)
  .maybeSingle();

  if (error) throw error;

  return data as LeaseTemplate | null;
},

  async getForProperty(
    entityId: string,
    propertyId: string,
    propertyType: string,
    client: SupabaseClient,
  ): Promise<LeaseTemplate[]> {
    const { data, error } = await client
      .from('lease_templates')
      .select('*')
      .eq('entity_id', entityId)
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .contains('applies_to_property_types', [propertyType])
      .order('category')
      .order('version', { ascending: false });

    if (error) throw error;

    return (data || []).filter((template: LeaseTemplate) => {
      const propertyIds = template.property_ids || [];

      return propertyIds.length === 0 || propertyIds.includes(propertyId);
    });
  },

  async getLatest(
    entityId: string,
    category: LeaseTemplateCategory,
    client: SupabaseClient,
  ): Promise<LeaseTemplate | null> {
    const { data, error } = await client
      .from('lease_templates')
      .select('*')
      .eq('entity_id', entityId)
      .eq('category', category)
      .eq('status', 'active')
      .eq('review_status', 'approved')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data as LeaseTemplate | null;
  },
};
