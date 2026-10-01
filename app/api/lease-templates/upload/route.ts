import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { processDocument } from '@/lib/document-intelligence/engine';
import { analyseLeaseTemplate } from '@/lib/lease/templates/analyser';
import { buildLeaseTemplateMappings } from '@/lib/lease/templates/mapping-builder';


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

  // Validate request metadata before accessing entity records.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    !(file instanceof File) ||
    typeof entityId !== 'string' ||
    typeof templateId !== 'string' ||
    !uuidPattern.test(entityId) ||
    !uuidPattern.test(templateId)
  ) {
    return NextResponse.json(
      { error: 'Invalid lease-template upload request' },
      { status: 400 },
    );
  }

  const maxFileBytes = 10 * 1024 * 1024;
  const allowedTypes = new Map([
    ['.pdf', 'application/pdf'],
    [
      '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ]);

  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const expectedMime = extension ? allowedTypes.get(extension) : undefined;

  if (
    !expectedMime ||
    file.type !== expectedMime ||
    file.name.length > 255
  ) {
    return NextResponse.json(
      { error: 'Upload a valid PDF or DOCX lease template' },
      { status: 415 },
    );
  }

  if (file.size === 0 || file.size > maxFileBytes) {
    return NextResponse.json(
      { error: 'File must be between 1 byte and 10 MB' },
      { status: 413 },
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

  // A verified session and entity membership are both required,
  // but neither independently grants permission to edit templates.
  const { data: canEdit, error: permissionError } =
    await serviceClient.rpc('has_entity_permission', {
      p_user_id: user.id,
      p_entity_id: entityId,
      p_permission_key: 'leasing.template.edit',
    });

  if (permissionError) {
    console.error('Lease-template permission check failed:', permissionError);
    return NextResponse.json(
      { error: 'Unable to verify lease-template permissions' },
      { status: 503 },
    );
  }

  if (canEdit !== true) {
    return NextResponse.json(
      { error: 'Lease-template editing permission required' },
      { status: 403 },
    );
  }

  const { data: template, error: templateError } = await serviceClient
    .from('lease_templates')
    .select('*')
    .eq('id', templateId)
    .eq('entity_id', entityId)
    .eq('status', 'draft')
    .eq('review_status', 'pending')
    .is('source_document_id', null)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: 'Draft lease template not found' },
      { status: 404 }
    );
  }

    let documentId = '';
  let storageKey = '';
  let attachmentAttempted = false;
  let uploadAttemptId = '';

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Reject obvious content-type spoofing before storage or OCR.
    const isPdf =
      extension === '.pdf' &&
      fileBuffer.subarray(0, 5).toString('ascii') === '%PDF-';

    const isDocx =
      extension === '.docx' &&
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x50 &&
      fileBuffer[1] === 0x4b &&
      fileBuffer[2] === 0x03 &&
      fileBuffer[3] === 0x04;

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: 'File content does not match its declared format' },
        { status: 415 },
      );
    }
const checksum = createHash('sha256').update(fileBuffer).digest('hex');

documentId = crypto.randomUUID();

    /*
     * Fail closed on duplicate checks. Never delete an existing document
     * merely because no template currently references it: another upload
     * may still be processing that document.
     */
    const { data: duplicates, error: duplicateError } =
      await serviceClient
        .from('documents')
        .select('id')
        .eq('entity_id', entityId)
        .eq('checksum', checksum)
        .limit(1);

    if (duplicateError) {
      throw new Error('Unable to verify document uniqueness');
    }

    if (duplicates?.length) {
      return NextResponse.json(
        {
          error: 'This document already exists for the selected entity',
          duplicate: true,
        },
        { status: 409 },
      );
    }

    // Reserve the source and target template before creating storage objects.
    // Database uniqueness constraints arbitrate concurrent requests.
    const { data: reservation, error: reservationError } =
      await serviceClient
        .from('lease_template_upload_attempts')
        .insert({
          entity_id: entityId,
          template_id: templateId,
          actor_id: user.id,
          checksum,
          status: 'reserved',
          lease_expires_at: new Date(
            Date.now() + 30 * 60 * 1000
          ).toISOString(),
        })
        .select('id')
        .single();

    if (reservationError) {
      if (reservationError.code === '23505') {
        return NextResponse.json(
          {
            error: 'An upload of this document or template already exists.',
            duplicate: true,
            retryable: false,
          },
          { status: 409 },
        );
      }

      throw new Error('Unable to reserve lease-template upload');
    }

    if (!reservation) {
      throw new Error('Upload reservation was not returned');
    }

    uploadAttemptId = reservation.id;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    storageKey =
  `lease-templates/${entityId}/${template.family_id || templateId}` +
  `/${documentId}-${safeName}`;

    // Record intended resource identifiers before creating either resource.
    // Recovery can inspect these identifiers after an interrupted upload.
    const { data: preparedAttempt, error: preparationError } =
      await serviceClient
        .from('lease_template_upload_attempts')
        .update({
          document_id: documentId,
          storage_key: storageKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadAttemptId)
        .eq('status', 'reserved')
        .select('id')
        .single();

    if (preparationError || !preparedAttempt) {
      throw new Error('Unable to prepare upload recovery identifiers');
    }

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

    // Persist the resources created by this upload before OCR begins.
    const { data: processingAttempt, error: processingError } =
      await serviceClient
        .from('lease_template_upload_attempts')
        .update({
          document_id: documentId,
          storage_key: storageKey,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadAttemptId)
        .eq('status', 'reserved')
        .select('id')
        .single();

    if (processingError || !processingAttempt) {
      throw new Error('Unable to record lease-template processing state');
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
  result.rawOcrText || result.ocrText || '',
  'blank_template'
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

   const {
  mappings: fieldMapping,
  suggestions: aiSuggestions,
} = buildLeaseTemplateMappings(templateAnalysis);

    // Persist the attachment boundary before invoking the RPC.
    const { data: attachingAttempt, error: attachingError } =
      await serviceClient
        .from('lease_template_upload_attempts')
        .update({
          status: 'attaching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadAttemptId)
        .eq('status', 'processing')
        .select('id')
        .single();

    if (attachingError || !attachingAttempt) {
      throw new Error('Unable to record lease-template attachment state');
    }

    attachmentAttempted = true;

    const { data: updatedTemplate, error: updateError } =
      await serviceClient.rpc('attach_lease_template_source', {
        p_template_id: templateId,
        p_entity_id: entityId,
        p_actor_id: user.id,
        p_document_id: documentId,
        p_checksum: checksum,
        p_field_mapping: fieldMapping,
        p_ai_suggestions: aiSuggestions,
        p_fields: templateAnalysis.fields,
          p_upload_attempt_id: uploadAttemptId,
      });

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

    if (uploadAttemptId) {
      // Do not delete resources or release the reservation here.
      // The attachment may have committed despite a network error.
      const { error: reconciliationError } = await serviceClient
        .from('lease_template_upload_attempts')
        .update({
          status: 'reconciliation_required',
          error_code: String(error?.code || 'UPLOAD_FAILED'),
          error_message: 'Upload requires reconciliation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadAttemptId)
        .in('status', ['reserved', 'processing', 'attaching']);

      if (reconciliationError) {
        console.error(
          'Unable to record upload reconciliation state:',
          { uploadAttemptId, reconciliationError },
        );
      }

      console.error('Upload resources retained for reconciliation:', {
        uploadAttemptId,
        entityId,
        templateId,
        documentId,
        storageKey,
        attachmentAttempted,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            'Upload requires reconciliation. Do not retry until its status is resolved.',
          retryable: false,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare lease-template upload.',
        retryable: true,
      },
      { status: 422 },
    );
  }
}
