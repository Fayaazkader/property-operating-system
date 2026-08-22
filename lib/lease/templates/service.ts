import { supabase } from '@/lib/supabase';
import type {
  LeaseTemplate,
  LeaseTemplateCategory,
  LeaseTemplateField,
} from './types';

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
  async createDraft(input: CreateLeaseTemplateInput): Promise<LeaseTemplate> {
    const { data: family, error: familyError } = await supabase
  .from('lease_template_families')
  .insert({
    entity_id: input.entityId,
    name: input.templateName,
    category: input.category,
    is_active: true,
    created_by: input.createdBy || null,
  })
  .select('id')
  .single();

if (familyError) throw familyError;

const familyId = family.id;

    const { data, error } = await supabase
      .from('lease_templates')
      .insert({
        entity_id: input.entityId,
        family_id: familyId,
        template_name: input.templateName,
        category: input.category,
        version: 1,
        status: 'draft',
        review_status: 'pending',
        source_document_id: null,
        source_document_url: null,
        source_file_name: null,
        source_mime_type: null,
        fields: [],
        field_mapping: [],
        ai_suggestions: [],
        clause_suggestions: [],
        property_ids: input.propertyIds || [],
        applies_to_property_types: input.appliesToPropertyTypes,
        ai_enabled: true,
        created_by: input.createdBy || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    return data as LeaseTemplate;
  },

  async update(
    templateId: string,
    entityId: string,
    input: UpdateLeaseTemplateInput
  ): Promise<LeaseTemplate> {
    const { data, error } = await supabase
      .from('lease_templates')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('entity_id', entityId)
      .eq('status', 'draft')
      .select('*')
      .single();

    if (error) throw error;

    return data as LeaseTemplate;
  },

  async attachSourceDocument(
    templateId: string,
    entityId: string,
    documentId: string,
    documentUrl: string,
    fileName: string,
    mimeType: string,
    checksum?: string
  ): Promise<LeaseTemplate> {
    const { data, error } = await supabase
      .from('lease_templates')
      .update({
        source_document_id: documentId,
        source_document_url: documentUrl,
        source_file_name: fileName,
        source_mime_type: mimeType,
        source_document_checksum: checksum || null,
        review_status: 'in_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('entity_id', entityId)
      .eq('status', 'draft')
      .select('*')
      .single();

    if (error) throw error;

    return data as LeaseTemplate;
  },

  async approve(
    templateId: string,
    entityId: string,
    reviewedBy: string
  ): Promise<LeaseTemplate> {
    const { data, error } = await supabase
      .from('lease_templates')
      .update({
        status: 'active',
        review_status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('entity_id', entityId)
      .eq('status', 'draft')
      .eq('review_status', 'in_review')
      .not('source_document_id', 'is', null)
      .select('*')
      .single();

    if (error) throw error;

    return data as LeaseTemplate;
  },

  async archive(
    templateId: string,
    entityId: string,
    archivedBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('lease_templates')
      .update({
        status: 'archived',
        archived_by: archivedBy,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('entity_id', entityId)
      .eq('status', 'active');

    if (error) throw error;
  },
  async getForReview(
  templateId: string,
  entityId: string
): Promise<LeaseTemplate | null> {
  const { data, error } = await supabase
    .from('lease_templates')
    .select('*')
    .eq('id', templateId)
    .eq('entity_id', entityId)
    .eq('status', 'draft')
    .eq('review_status', 'in_review')
    .maybeSingle();

  if (error) throw error;

  return data as LeaseTemplate | null;
},

  async getForProperty(
    entityId: string,
    propertyId: string,
    propertyType: string
  ): Promise<LeaseTemplate[]> {
    const { data, error } = await supabase
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
    category: LeaseTemplateCategory
  ): Promise<LeaseTemplate | null> {
    const { data, error } = await supabase
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
