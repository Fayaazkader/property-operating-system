import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyseLeaseTemplate } from '@/lib/lease/templates/analyser';
import { buildLeaseTemplateMappings } from '@/lib/lease/templates/mapping-builder';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const {
    data: { user },
  } = await authClient.auth.getUser(accessToken);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid recovery request' },
      { status: 400 },
    );
  }

  const attemptId =
    typeof body === 'object' &&
    body !== null &&
    'attemptId' in body &&
    typeof body.attemptId === 'string'
      ? body.attemptId
      : null;

  const entityId =
    typeof body === 'object' &&
    body !== null &&
    'entityId' in body &&
    typeof body.entityId === 'string'
      ? body.entityId
      : null;

  if (
    !attemptId ||
    !entityId ||
    !UUID_PATTERN.test(attemptId) ||
    !UUID_PATTERN.test(entityId)
  ) {
    return NextResponse.json(
      { error: 'Valid attemptId and entityId are required' },
      { status: 400 },
    );
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let recoveryGeneration: number | null = null;
  let recoveryResumed = false;

  try {
    /*
     * Claim first. PostgreSQL rechecks membership, edit permission, current
     * state and lease expiry under the governed lock order.
     */
    const { data: claimed, error: claimError } = await serviceClient.rpc(
      'claim_lease_template_upload_recovery',
      {
        p_attempt_id: attemptId,
        p_entity_id: entityId,
        p_actor_id: user.id,
      },
    );

    if (claimError) {
      throw claimError;
    }

    if (
      !claimed ||
      typeof claimed.lease_generation !== 'number' ||
      claimed.lease_generation <= 0
    ) {
      throw new Error('Recovery claim was not returned correctly');
    }

    /*
     * Terminal attempts are observational outcomes, not recovery work.
     */
    if (claimed.status === 'attached') {
      return NextResponse.json({
        success: true,
        recovered: false,
        status: 'attached',
        attemptId,
      });
    }

    if (claimed.status === 'cleaned_up') {
      return NextResponse.json({
        success: true,
        recovered: false,
        status: 'cleaned_up',
        attemptId,
      });
    }

    const generation = claimed.lease_generation;
    recoveryGeneration = generation;

    const { data: inspection, error: inspectionError } =
      await serviceClient.rpc(
        'inspect_claimed_lease_template_upload_recovery',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
        },
      );

    if (inspectionError) {
      throw inspectionError;
    }

    if (
      !inspection ||
      inspection.attempt_id !== attemptId ||
      inspection.lease_generation !== generation ||
      inspection.template_id !== claimed.template_id ||
      inspection.document_id !== claimed.document_id ||
      inspection.storage_key !== claimed.storage_key ||
      inspection.checksum !== claimed.checksum
    ) {
      throw new Error('Claimed recovery inspection is inconsistent');
    }

    if (inspection.document_attached_to_attempt_template) {
      /*
       * Attachment may have committed before the original HTTP response was
       * lost. Normalize only the ledger terminal state; the RPC independently
       * proves the exact template/document identity under locks.
       */
      const { data: normalized, error: normalizationError } =
        await serviceClient.rpc(
          'normalize_claimed_lease_template_upload_attachment',
          {
            p_attempt_id: attemptId,
            p_entity_id: entityId,
            p_actor_id: user.id,
            p_expected_generation: generation,
          },
        );

      if (normalizationError) {
        throw normalizationError;
      }

      if (!normalized || normalized.status !== 'attached') {
        throw new Error('Recovered attachment was not normalized');
      }

      return NextResponse.json({
        success: true,
        recovered: true,
        status: 'attached',
        attemptId,
        templateId: inspection.template_id,
        documentId: inspection.document_id,
      });
    }

    /*
     * Conflicting logical references are reconciliation cases. They must never
     * enter automatic cleanup or resume.
     */
    if (
      inspection.template_has_different_document ||
      inspection.document_attached_to_any_template ||
      inspection.has_cleanup_blockers
    ) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'RECOVERY_BLOCKED',
          p_error_message:
            'Recovery inspection found conflicting or dependent document state.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      return NextResponse.json(
        {
          success: false,
          recovered: false,
          status: 'reconciliation_required',
          attemptId,
        },
        { status: 409 },
      );
    }

    /*
     * Storage is external to PostgreSQL. Inspect the exact reserved key and
     * fail closed on every error other than a confirmed 404.
     */
    let storageExists = false;
    let storageInspectionError = false;

    if (inspection.requires_storage_inspection && inspection.storage_key) {
      const { data: object, error: storageError } = await serviceClient.storage
        .from('documents')
        .info(inspection.storage_key);

      if (!storageError) {
        storageExists = object !== null;
      } else if (storageError.status === 404) {
        storageExists = false;
      } else {
        storageInspectionError = true;
      }
    }

    if (storageInspectionError) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'STORAGE_INSPECTION_FAILED',
          p_error_message:
            'Recovery could not positively establish the source object state.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      return NextResponse.json(
        {
          success: false,
          recovered: false,
          status: 'reconciliation_required',
          attemptId,
        },
        { status: 409 },
      );
    }

    /*
     * A missing canonical document with a present attempt-owned Storage object
     * is an orphan cleanup case. An existing canonical document must match the
     * attempt exactly before any destructive Storage action is permitted.
     */
    const cleanupCandidate =
      !inspection.has_cleanup_blockers &&
      (
        !inspection.document_exists ||
        inspection.document_matches_attempt
      );

    if (!storageExists && cleanupCandidate) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'SOURCE_OBJECT_MISSING',
          p_error_message:
            'The exact reserved source object is absent; governed cleanup is being finalized.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      const { data: cleaned, error: cleanupError } = await serviceClient.rpc(
        'finalize_lease_template_upload_cleanup',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
        },
      );

      if (cleanupError) {
        throw cleanupError;
      }

      if (!cleaned || cleaned.status !== 'cleaned_up') {
        throw new Error('Lease-template upload cleanup was not finalized');
      }

      return NextResponse.json({
        success: true,
        recovered: true,
        status: 'cleaned_up',
        attemptId,
      });
    }

    if (
      storageExists &&
      cleanupCandidate &&
      !inspection.document_exists &&
      inspection.storage_key
    ) {
      /*
       * The exact reserved Storage object exists but its canonical document
       * does not. Mark reconciliation while preserving the claimed generation
       * and lease, then remove only that attempt-owned object.
       */
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'ORPHAN_STORAGE_OBJECT',
          p_error_message:
            'The reserved source object exists without its canonical document; governed orphan cleanup is being finalized.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      const { error: removalError } = await serviceClient.storage
        .from('documents')
        .remove([inspection.storage_key]);

      if (removalError) {
        throw new Error('Lease-template orphan Storage cleanup failed');
      }

      /*
       * Storage deletion is external to PostgreSQL. Never trust the remove()
       * response alone: positively verify the exact object is absent.
       */
      const { data: remainingObject, error: verificationError } =
        await serviceClient.storage
          .from('documents')
          .info(inspection.storage_key);

      if (!verificationError || remainingObject !== null) {
        throw new Error(
          'Lease-template orphan Storage cleanup could not be verified',
        );
      }

      if (verificationError.status !== 404) {
        throw new Error(
          'Lease-template orphan Storage absence could not be established',
        );
      }

      const { data: cleaned, error: cleanupError } = await serviceClient.rpc(
        'finalize_lease_template_upload_cleanup',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
        },
      );

      if (cleanupError) {
        throw cleanupError;
      }

      if (!cleaned || cleaned.status !== 'cleaned_up') {
        throw new Error('Lease-template upload cleanup was not finalized');
      }

      return NextResponse.json({
        success: true,
        recovered: true,
        status: 'cleaned_up',
        attemptId,
      });
    }

    if (!storageExists) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'RECOVERY_STATE_MISMATCH',
          p_error_message:
            'The source object is absent but database state is not eligible for automatic cleanup.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      return NextResponse.json(
        {
          success: false,
          recovered: false,
          status: 'reconciliation_required',
          attemptId,
        },
        { status: 409 },
      );
    }

    if (
      !inspection.document_exists ||
      !inspection.document_matches_attempt ||
      !inspection.document_id
    ) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: generation,
          p_error_code: 'CANONICAL_DOCUMENT_MISMATCH',
          p_error_message:
            'The canonical source document is missing or does not match the upload attempt.',
        },
      );

      if (reconciliationError) {
        throw reconciliationError;
      }

      return NextResponse.json(
        {
          success: false,
          recovered: false,
          status: 'reconciliation_required',
          attemptId,
        },
        { status: 409 },
      );
    }

    /*
     * The resume RPC verifies the exact canonical identity, durable raw OCR,
     * template eligibility, fencing generation and active recovery lease.
     */
    const { data: resumed, error: resumeError } = await serviceClient.rpc(
      'resume_claimed_lease_template_upload',
      {
        p_attempt_id: attemptId,
        p_entity_id: entityId,
        p_actor_id: user.id,
        p_expected_generation: generation,
      },
    );

    if (resumeError) {
      throw resumeError;
    }

    if (!resumed || resumed.status !== 'processing') {
      throw new Error('Recovery resume was not returned correctly');
    }

    recoveryResumed = true;

    const { data: document, error: documentError } = await serviceClient
      .from('documents')
      .select('id, raw_ocr_text, checksum, storage_key')
      .eq('id', inspection.document_id)
      .eq('entity_id', entityId)
      .single();

    if (documentError || !document) {
      throw documentError ?? new Error('Recovery document was not found');
    }

    const rawOcrText =
      typeof document.raw_ocr_text === 'string'
        ? document.raw_ocr_text.trim()
        : '';

    if (!rawOcrText) {
      throw new Error('Durable OCR checkpoint is unavailable');
    }

    if (
      document.checksum !== inspection.checksum ||
      document.storage_key !== inspection.storage_key
    ) {
      throw new Error('Recovery document identity changed');
    }

    /*
     * Rebuild exactly the deterministic products used by the normal upload
     * path. No mapping is approved automatically.
     */
    const templateAnalysis = analyseLeaseTemplate(
      rawOcrText,
      'blank_template',
    );

    const {
      mappings: fieldMapping,
      suggestions: aiSuggestions,
    } = buildLeaseTemplateMappings(templateAnalysis);

    const { data: attaching, error: transitionError } =
      await serviceClient.rpc('transition_lease_template_upload_attempt', {
        p_attempt_id: attemptId,
        p_entity_id: entityId,
        p_actor_id: user.id,
        p_expected_generation: generation,
        p_expected_status: 'processing',
        p_new_status: 'attaching',
        p_error_code: null,
        p_error_message: null,
      });

    if (transitionError) {
      throw transitionError;
    }

    if (!attaching || attaching.status !== 'attaching') {
      throw new Error('Recovery attachment transition failed');
    }

    const { data: template, error: attachmentError } =
      await serviceClient.rpc('attach_lease_template_source', {
        p_template_id: inspection.template_id,
        p_entity_id: entityId,
        p_actor_id: user.id,
        p_document_id: inspection.document_id,
        p_checksum: inspection.checksum,
        p_field_mapping: fieldMapping,
        p_ai_suggestions: aiSuggestions,
        p_fields: templateAnalysis.fields,
        p_upload_attempt_id: attemptId,
        p_expected_generation: generation,
      });

    if (attachmentError) {
      throw attachmentError;
    }

    return NextResponse.json({
      success: true,
      recovered: true,
      status: 'attached',
      attemptId,
      documentId: inspection.document_id,
      template,
      analysis: {
        placeholders: templateAnalysis.placeholders,
        fields: templateAnalysis.fields,
        suggestions: templateAnalysis.suggestions,
        confidence: templateAnalysis.overallConfidence,
      },
    });
  } catch (error: any) {
    console.error('Lease-template upload recovery error:', {
      code: error?.code ?? null,
      message:
        typeof error?.message === 'string'
          ? error.message
          : 'Unknown recovery error',
    });

    /*
     * Once the claimed worker has crossed into processing, a known failure
     * should not be left as an apparently active worker until lease expiry.
     * Record governed reconciliation while the same generation still owns the
     * recovery lease. Failure to record reconciliation is logged separately;
     * the original recovery failure remains the client-facing result.
     */
    if (recoveryResumed && recoveryGeneration !== null) {
      const { error: reconciliationError } = await serviceClient.rpc(
        'mark_claimed_lease_template_upload_for_reconciliation',
        {
          p_attempt_id: attemptId,
          p_entity_id: entityId,
          p_actor_id: user.id,
          p_expected_generation: recoveryGeneration,
          p_error_code: 'RECOVERY_EXECUTION_FAILED',
          p_error_message:
            'Claimed recovery failed after resume and requires reconciliation.',
        },
      );

      if (reconciliationError) {
        console.error('Lease-template recovery reconciliation failed:', {
          code: reconciliationError.code ?? null,
          message: reconciliationError.message,
        });
      }
    }

    return NextResponse.json(
      { error: 'Unable to recover lease-template upload safely' },
      { status: 500 },
    );
  }
}
