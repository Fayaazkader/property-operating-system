import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { processDocument } from '@/lib/document-intelligence/engine';
import { analyseLeaseTemplate } from '@/lib/lease/templates/analyser';
import type { DocumentEvidence } from '@/lib/document-intelligence/ocr-adapter';

function getFieldConfidence(
  fieldKey: string,
  result: Awaited<ReturnType<typeof processDocument>>
): number {
  const value = result.extractedFields?.[fieldKey];

  if (value === undefined || value === null || value === '') {
    return 0;
  }

  /*
   * The current Document Intelligence result exposes overall
   * extraction confidence rather than per-field confidence.
   *
   * Until per-field confidence is surfaced through the engine,
   * use the overall extraction confidence as the review confidence.
   */
  return result.extractedFields?.confidence ?? 0;
}

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

    let documentId = '';
  let storageKey = '';

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
const checksum = createHash('sha256').update(fileBuffer).digest('hex');

documentId = crypto.randomUUID();

    /*
     * Prevent the exact same source document from being attached twice
     * to this template family.
     */
    const { data: duplicate } = await serviceClient
  .from('documents')
  .select(`
    id,
    document_type,
    status,
    file_name
  `)
  .eq('entity_id', entityId)
  .eq('checksum', checksum)
  .maybeSingle();

if (duplicate) {
  /*
   * A checksum match is only a genuine duplicate if the existing
   * document belongs to a completed/usable document workflow.
   *
   * Failed lease-template uploads may have left an orphaned document
   * record. Those records must not permanently block a retry.
   */
  const { data: existingTemplate } = await serviceClient
    .from('lease_templates')
    .select(`
      id,
      family_id,
      status,
      review_status,
      source_document_id
    `)
    .eq('entity_id', entityId)
    .eq('source_document_id', duplicate.id)
    .maybeSingle();

  const isIncompleteLeaseTemplate =
    duplicate.document_type === 'lease_template_source' &&
    (
      !existingTemplate ||
      (
        existingTemplate.status === 'draft' &&
        existingTemplate.review_status !== 'approved'
      )
    );

  if (!isIncompleteLeaseTemplate) {
    return NextResponse.json(
      {
        error:
          'This document has already been uploaded to AssetFlow.',
        documentId: duplicate.id,
      },
      { status: 409 }
    );
  }

  /*
   * Existing record belongs to an incomplete lease-template attempt.
   * Remove it so the current upload can proceed normally.
   */

  if (existingTemplate?.id) {
    const { error: templateCleanupError } =
      await serviceClient
        .from('lease_templates')
        .delete()
        .eq('id', existingTemplate.id)
        .eq('entity_id', entityId)
        .eq('status', 'draft');

    if (templateCleanupError) {
      console.error(
        'Failed to remove incomplete lease template:',
        templateCleanupError
      );

      return NextResponse.json(
        {
          error:
            'The previous failed upload could not be cleaned up. Please try again.',
          retryable: true,
        },
        { status: 422 }
      );
    }

    if (existingTemplate.family_id) {
      const { error: familyCleanupError } =
        await serviceClient
          .from('lease_template_families')
          .delete()
          .eq('id', existingTemplate.family_id)
          .eq('entity_id', entityId);

      if (familyCleanupError) {
        console.error(
          'Failed to remove incomplete lease template family:',
          familyCleanupError
        );
      }
    }
  }

  const { error: documentCleanupError } =
    await serviceClient
      .from('documents')
      .delete()
      .eq('id', duplicate.id)
      .eq('entity_id', entityId);

  if (documentCleanupError) {
    console.error(
      'Failed to remove orphaned lease-template document:',
      documentCleanupError
    );

    return NextResponse.json(
      {
        error:
          'The previous failed upload could not be cleaned up. Please try again.',
        retryable: true,
      },
      { status: 422 }
    );
  }
}

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    storageKey =
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

if (!templateAnalysis.validation.valid) {
  const reasons = templateAnalysis.validation.errors
    .map(error => error.message)
    .join('; ');

  throw new Error(
    `Lease template validation failed: ${reasons}`
  );
}

    /*
     * Extract field candidates from the analysis. These remain
     * suggestions until the user reviews and approves them.
     */
    const extractedFields = result.extractedFields || {};

    function toLeaseFieldEvidence(
  evidence: DocumentEvidence[]
) {
  return evidence.map(item => ({
    text: item.text,
    page: item.location?.page,
    startOffset: item.location?.startOffset,
    endOffset: item.location?.endOffset,
    boundingBox:
      item.location?.x !== undefined &&
      item.location?.y !== undefined &&
      item.location?.width !== undefined &&
      item.location?.height !== undefined
        ? {
            x: item.location.x,
            y: item.location.y,
            width: item.location.width,
            height: item.location.height,
          }
        : undefined,
  }));
}

const fieldMapping = templateAnalysis.fields.map(field => ({
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,

  value: field.value ?? null,

  confidence: field.confidence ?? 0,

  source: field.source || 'ai',

  evidence:
  result.fieldEvidence?.[field.key]?.length
    ? toLeaseFieldEvidence(
        result.fieldEvidence[field.key]
      )
    : field.evidence || [],

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

  /*
   * Failed uploads are transactional.
   *
   * A lease template only becomes visible as a usable draft/in-review
   * template after document processing and validation succeed.
   *
   * If processing fails:
   * - remove the uploaded storage object
   * - remove the documents row
   * - remove the incomplete lease template
   * - remove its draft family
   *
   * This prevents dead drafts from remaining in the UI and allows
   * the same source document to be uploaded again.
   */

  try {
    // 1. Remove uploaded source document from storage.
    if (storageKey) {
      const { error: storageCleanupError } =
        await serviceClient.storage
          .from('documents')
          .remove([storageKey]);

      if (storageCleanupError) {
        console.error(
          'Lease template storage cleanup failed:',
          storageCleanupError
        );
      }
    }

    // 2. Remove canonical document record.
    if (documentId) {
      const { error: documentCleanupError } =
        await serviceClient
          .from('documents')
          .delete()
          .eq('id', documentId)
          .eq('entity_id', entityId);

      if (documentCleanupError) {
        console.error(
          'Lease template document cleanup failed:',
          documentCleanupError
        );
      }
    }

    // 3. Find the incomplete draft template.
    const { data: failedTemplate, error: templateLookupError } =
      await serviceClient
        .from('lease_templates')
        .select('id, family_id')
        .eq('id', templateId)
        .eq('entity_id', entityId)
        .eq('status', 'draft')
        .maybeSingle();

    if (templateLookupError) {
      console.error(
        'Lease template draft lookup failed:',
        templateLookupError
      );
    } else if (failedTemplate) {
      // 4. Remove the incomplete draft template.
      const { error: templateCleanupError } =
        await serviceClient
          .from('lease_templates')
          .delete()
          .eq('id', failedTemplate.id)
          .eq('entity_id', entityId)
          .eq('status', 'draft');

      if (templateCleanupError) {
        console.error(
          'Lease template draft cleanup failed:',
          templateCleanupError
        );
      }

      // 5. Remove the associated draft family.
      if (failedTemplate.family_id) {
        const { error: familyCleanupError } =
          await serviceClient
            .from('lease_template_families')
            .delete()
            .eq('id', failedTemplate.family_id)
            .eq('entity_id', entityId);

        if (familyCleanupError) {
          console.error(
            'Lease template family cleanup failed:',
            familyCleanupError
          );
        }
      }
    }
  } catch (cleanupError) {
    console.error(
      'Lease template upload cleanup failed:',
      cleanupError
    );
  }

  return NextResponse.json(
    {
      success: false,
      error:
        error?.message ||
        'Failed to process lease template. Please review the document and try again.',
      retryable: true,
    },
    { status: 422 }
  );
}
}
