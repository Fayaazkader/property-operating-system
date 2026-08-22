import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { processDocument } from '@/lib/document-intelligence/engine';
import { analyseLeaseTemplate } from '@/lib/lease/templates/analyser';



export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const {
    data: { user },
  } = await authClient.auth.getUser(accessToken);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const formData = await request.formData();

  const file = formData.get('file') as File | null;
  const entityId = formData.get('entityId') as string | null;
  const templateId = formData.get('templateId') as string | null;

  if (!file || !entityId || !templateId) {
    return NextResponse.json(
      { error: 'file, entityId and templateId are required' },
      { status: 400 }
    );
  }

  const { data: access } = await serviceClient
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', entityId)
    .single();

  if (!access) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { data: template, error: templateError } = await serviceClient
    .from('lease_templates')
    .select('*')
    .eq('id', templateId)
    .eq('entity_id', entityId)
    .eq('status', 'draft')
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: 'Draft lease template not found' },
      { status: 404 }
    );
  }

  try {
    const documentId = crypto.randomUUID();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    /*
     * Prevent the exact same source document from being attached twice
     * to this template family.
     */
    const { data: duplicate } = await serviceClient
      .from('documents')
      .select('id')
      .eq('entity_id', entityId)
      .eq('checksum', checksum)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        {
          error: 'This document has already been uploaded to AssetFlow.',
          documentId: duplicate.id,
        },
        { status: 409 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const storageKey =
      `lease-templates/${entityId}/${template.family_id || templateId}` +
      `/${documentId}-${safeName}`;

    const { error: uploadError } = await serviceClient.storage
      .from('documents')
      .upload(storageKey, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Document storage upload failed: ${uploadError.message}`
      );
    }

    /*
     * Store the canonical document record using the existing
     * production documents schema.
     */
    const { data: document, error: documentError } =
      await serviceClient
        .from('documents')
        .insert({
          id: documentId,
          entity_id: entityId,
          file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_size_bytes: fileBuffer.length,
          storage_provider: 'supabase',
          storage_bucket: 'documents',
          storage_key: storageKey,
          storage_version: 'v1',
          checksum,
          document_type: 'lease_template_source',
          status: 'received',
          requires_review: true,
          source: 'upload',
          uploaded_by: user.id,
          version_number: 1,
          is_latest_version: true,
        })
        .select('*')
        .single();

    if (documentError) {
      throw documentError;
    }

    /*
     * AssetFlow's document intelligence pipeline analyses the client's
     * actual lease. It does not generate or replace the legal document.
     */
    const result = await processDocument(
      fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ),
      file.name,
      file.type || 'application/octet-stream',
      undefined,
      {
        documentId,
        channel: 'lease_template',
        templateId,
        entityId,
      },
      serviceClient
    );

    const templateAnalysis = analyseLeaseTemplate(
  result.rawOcrText || result.ocrText || ''
);

    /*
     * Extract field candidates from the analysis. These remain
     * suggestions until the user reviews and approves them.
     */
    const extractedFields = result.extractedFields || {};

const fieldMapping = templateAnalysis.fields.map(field => ({
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,
  source: field.source || 'ai',
  approved: false,
}));

const aiSuggestions = templateAnalysis.suggestions;

    const { data: updatedTemplate, error: updateError } =
      await serviceClient
        .from('lease_templates')
        .update({
  source_document_id: documentId,
  source_document_checksum: checksum,
  source_file_name: file.name,
  source_mime_type: file.type || 'application/octet-stream',
  source_document_url: storageKey,
  field_mapping: fieldMapping,
  ai_suggestions: aiSuggestions,
  clause_suggestions: [],
  fields: fieldMapping,
  review_status: 'in_review',
  status: 'draft',
  updated_at: new Date().toISOString(),
})
        .eq('id', templateId)
        .eq('entity_id', entityId)
        .eq('status', 'draft')
        .select('*')
        .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      document,
      template: updatedTemplate,
      analysis: {
  documentType: result.documentType,
  extractedFields,
  placeholders: templateAnalysis.placeholders,
  fields: templateAnalysis.fields,
  suggestions: templateAnalysis.suggestions,
  confidence: templateAnalysis.overallConfidence,
  ocrConfidence: result.ocrConfidence,
  workflowId: result.workflowId,
  message: result.message,
},
    });
  } catch (error: any) {
    console.error('Lease template upload error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Failed to process lease template',
      },
      { status: 500 }
    );
  }
}
