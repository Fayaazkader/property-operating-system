import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { analyseLeaseTemplate } from '@/lib/lease/templates/analyser';
import { buildLeaseTemplateMappings } from '@/lib/lease/templates/mapping-builder';

interface RouteContext {
  params: Promise<{
    templateId: string;
  }>;
}

interface ReanalyseRequest {
  entityId?: string;
}

function rpcErrorStatus(message: string): number {
  const normalised = message.toLowerCase();

  if (normalised.includes('access denied')) {
    return 403;
  }

  if (normalised.includes('not found')) {
    return 404;
  }

  if (
    normalised.includes('not currently available') ||
    normalised.includes('state changed') ||
    normalised.includes('source identity changed') ||
    normalised.includes('source document changed')
  ) {
    return 409;
  }

  if (
    normalised.includes('invalid') ||
    normalised.includes('deterministic target identity')
  ) {
    return 422;
  }

  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required.' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: ReanalyseRequest;

    try {
      body = (await request.json()) as ReanalyseRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const entityId =
      typeof body.entityId === 'string'
        ? body.entityId.trim()
        : '';

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required.' },
        { status: 400 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * Read only the immutable source identity needed to reproduce analysis.
     * The authoritative permission/state/source checks are repeated inside
     * the transactional RPC before anything is persisted.
     */
    const { data: template, error: templateError } =
      await serviceClient
        .from('lease_templates')
        .select(
          'id, entity_id, status, review_status, source_document_id, source_document_checksum'
        )
        .eq('id', templateId)
        .eq('entity_id', entityId)
        .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Lease template not found.' },
        { status: 404 }
      );
    }

    if (
      typeof template.source_document_id !== 'string' ||
      !template.source_document_id ||
      typeof template.source_document_checksum !== 'string' ||
      !template.source_document_checksum
    ) {
      return NextResponse.json(
        {
          error:
            'Lease template does not have a canonical source document.',
        },
        { status: 409 }
      );
    }

    const { data: document, error: documentError } =
      await serviceClient
        .from('documents')
        .select('id, entity_id, raw_ocr_text, checksum')
        .eq('id', template.source_document_id)
        .eq('entity_id', entityId)
        .single();

    if (documentError || !document) {
      return NextResponse.json(
        {
          error:
            'Lease-template source document was not found.',
        },
        { status: 409 }
      );
    }

    if (
      document.checksum !== template.source_document_checksum
    ) {
      return NextResponse.json(
        {
          error:
            'Lease-template source document identity changed.',
        },
        { status: 409 }
      );
    }

    const rawOcrText =
      typeof document.raw_ocr_text === 'string'
        ? document.raw_ocr_text.trim()
        : '';

    if (!rawOcrText) {
      return NextResponse.json(
        {
          error:
            'Durable OCR text is unavailable for re-analysis.',
        },
        { status: 409 }
      );
    }

    const analysis = analyseLeaseTemplate(
      rawOcrText,
      'blank_template'
    );

    if (!analysis.validation.valid) {
      const reasons = analysis.validation.errors
        .map(error => error.message)
        .join('; ');

      return NextResponse.json(
        {
          error:
            `Lease template validation failed: ${reasons}`,
        },
        { status: 422 }
      );
    }

    const {
      mappings,
      suggestions,
    } = buildLeaseTemplateMappings(analysis);

    const { data, error } = await serviceClient.rpc(
      'reanalyse_lease_template',
      {
        p_template_id: templateId,
        p_entity_id: entityId,
        p_user_id: user.id,
        p_user_email: user.email ?? null,
        p_source_document_id: document.id,
        p_source_document_checksum: document.checksum,
        p_field_mapping: mappings,
        p_ai_suggestions: suggestions,
        p_fields: analysis.fields,
        p_user_agent: request.headers.get('user-agent'),
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: rpcErrorStatus(error.message) }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: {
        placeholders: analysis.placeholders,
        fields: analysis.fields,
        suggestions: analysis.suggestions,
        confidence: analysis.overallConfidence,
      },
      template: data,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to re-analyse lease template.';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
