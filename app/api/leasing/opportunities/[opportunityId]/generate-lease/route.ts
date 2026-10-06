import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  generateLeaseDocument,
  LeaseGenerationError,
} from '@/lib/lease/generation/generate';
import { LeaseGenerationAuthorityError } from '@/lib/lease/generation/service';

interface RouteContext {
  params: Promise<{
    opportunityId: string;
  }>;
}

interface GenerateLeaseRequest {
  entityId?: string;
  templateId?: string;
}

function authorityErrorStatus(
  error: LeaseGenerationAuthorityError,
): number {
  switch (error.code) {
    case 'permission_denied':
      return 403;

    case 'opportunity_not_found':
    case 'approved_version_not_found':
    case 'property_not_found':
    case 'unit_not_found':
    case 'template_not_found':
      return 404;

    case 'commercial_terms_not_approved':
    case 'authority_mismatch':
    case 'template_not_applicable':
    case 'template_source_missing':
      return 409;

    case 'generation_invalid':
      return 422;

    default:
      return 500;
  }
}

function generationErrorStatus(
  error: LeaseGenerationError,
): number {
  switch (error.code) {
    case 'unsupported_format':
      return 422;

    case 'storage_upload_failed':
    case 'registration_failed':
    case 'registration_invalid':
      return 500;

    default:
      return 500;
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { opportunityId } = await params;

    if (
      typeof opportunityId !== 'string' ||
      opportunityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'opportunityId is required.' },
        { status: 400 },
      );
    }

    /*
     * Authenticate the real caller.
     *
     * actorId is never accepted from request JSON. Generation authority must
     * always be evaluated against the Supabase user represented by the bearer
     * token.
     */
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
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
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    let body: GenerateLeaseRequest;

    try {
      body = (await request.json()) as GenerateLeaseRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 },
      );
    }

    const { entityId, templateId } = body;

    if (
      typeof entityId !== 'string' ||
      entityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'entityId is required.' },
        { status: 400 },
      );
    }

    if (
      typeof templateId !== 'string' ||
      templateId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'templateId is required.' },
        { status: 400 },
      );
    }

    /*
     * Privileged infrastructure client.
     *
     * The service-role key never leaves the server. The generation service and
     * registration RPC independently enforce the authenticated actor's
     * canonical entity permission and commercial/template authority.
     */
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const generated = await generateLeaseDocument(
      {
        entityId: entityId.trim(),
        opportunityId: opportunityId.trim(),
        templateId: templateId.trim(),
        actorId: user.id,
      },
      serviceClient,
    );

    return NextResponse.json({
      success: true,
      document: generated,
    });
  } catch (error) {
    if (error instanceof LeaseGenerationAuthorityError) {
      console.warn(
        '[LEASE GENERATION] Authority rejected:',
        error.code,
        error.message,
      );

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: authorityErrorStatus(error) },
      );
    }

    if (error instanceof LeaseGenerationError) {
      console.error(
        '[LEASE GENERATION] Generation failed:',
        error.code,
        error.message,
      );

      /*
       * Storage/database implementation details are intentionally not returned
       * to the browser for infrastructure failures.
       */
      const safeMessage =
        error.code === 'unsupported_format'
          ? error.message
          : 'Unable to generate the lease document.';

      return NextResponse.json(
        {
          error: safeMessage,
          code: error.code,
        },
        { status: generationErrorStatus(error) },
      );
    }

    console.error(
      '[LEASE GENERATION] Unexpected failure:',
      error,
    );

    return NextResponse.json(
      { error: 'Unable to generate the lease document.' },
      { status: 500 },
    );
  }
}
