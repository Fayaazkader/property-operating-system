import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  isCanonicalLeaseFieldKey,
} from '@/lib/lease/templates/field-registry';

interface RouteContext {
  params: Promise<{
    templateId: string;
  }>;
}

type MappingReviewAction =
  | 'confirm'
  | 'correct'
  | 'reject'
  | 'assign';

interface MappingReviewRequest {
  entityId?: string;
  action?: MappingReviewAction;
  mappingId?: string;
  suggestionId?: string;
  fieldKey?: string;
}

function isMappingReviewAction(
  value: unknown
): value is MappingReviewAction {
  return (
    value === 'confirm' ||
    value === 'correct' ||
    value === 'reject' ||
    value === 'assign'
  );
}

function rpcErrorStatus(message: string): number {
  const normalised = message.toLowerCase();

  if (normalised.includes('access denied')) {
    return 403;
  }

  if (
    normalised.includes('not found') ||
    normalised.includes('mapping not found') ||
    normalised.includes('suggestion not found')
  ) {
    return 404;
  }

  if (
    normalised.includes('not currently available') ||
    normalised.includes('already')
  ) {
    return 409;
  }

  if (
    normalised.includes('canonical') ||
    normalised.includes('valid document target') ||
    normalised.includes('reusable document target') ||
    normalised.includes('does not contain')
  ) {
    return 422;
  }

  return 500;
}

export async function PATCH(
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

    /*
     * Authenticate the caller from the bearer token.
     *
     * The service-role client below is used only after this token has been
     * independently resolved to a real Supabase Auth user.
     */
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

    let body: MappingReviewRequest;

    try {
      body =
        (await request.json()) as MappingReviewRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const {
      entityId,
      action,
      mappingId,
      suggestionId,
      fieldKey,
    } = body;

    if (
      typeof entityId !== 'string' ||
      entityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'entityId is required.' },
        { status: 400 }
      );
    }

    if (!isMappingReviewAction(action)) {
      return NextResponse.json(
        { error: 'Unsupported mapping review action.' },
        { status: 400 }
      );
    }

    /*
     * Validate the action contract before entering the database
     * transaction.
     */
    if (
      action === 'confirm' ||
      action === 'correct' ||
      action === 'reject'
    ) {
      if (
        typeof mappingId !== 'string' ||
        mappingId.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error:
              'mappingId is required for this review action.',
          },
          { status: 400 }
        );
      }
    }

    if (action === 'assign') {
      if (
        typeof suggestionId !== 'string' ||
        suggestionId.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error:
              'suggestionId is required when assigning an unresolved target.',
          },
          { status: 400 }
        );
      }
    }

    if (
      action === 'correct' ||
      action === 'assign'
    ) {
      if (
        typeof fieldKey !== 'string' ||
        fieldKey.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error:
              'fieldKey is required for this review action.',
          },
          { status: 400 }
        );
      }

      if (!isCanonicalLeaseFieldKey(fieldKey)) {
        return NextResponse.json(
          {
            error:
              'The selected field is not a recognised AssetFlow lease field.',
          },
          { status: 422 }
        );
      }
    }

    /*
     * The service role is required because the governance RPC is deliberately
     * not exposed to browser/authenticated-role execution.
     *
     * The RPC independently verifies:
     *   user.id -> entityId membership
     * before locking or mutating the template.
     *
     * The API therefore does not duplicate the transaction's authoritative
     * authorisation or state checks.
     */
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

    const { data, error } = await serviceClient.rpc(
      'review_lease_template_mapping',
      {
        p_template_id: templateId,
        p_entity_id: entityId,
        p_user_id: user.id,
        p_user_email: user.email ?? null,
        p_action: action,
        p_mapping_id:
          typeof mappingId === 'string'
            ? mappingId
            : null,
        p_suggestion_id:
          typeof suggestionId === 'string'
            ? suggestionId
            : null,
        p_field_key:
          typeof fieldKey === 'string'
            ? fieldKey
            : null,
        p_user_agent:
          request.headers.get('user-agent'),
      }
    );

    if (error) {
      console.error(
        '[LEASE TEMPLATE MAPPING REVIEW] RPC failed:',
        error
      );

      const message =
        error.message ||
        'Unable to review lease-template mapping.';

      return NextResponse.json(
        { error: message },
        { status: rpcErrorStatus(message) }
      );
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      console.error(
        '[LEASE TEMPLATE MAPPING REVIEW] Invalid RPC response:',
        data
      );

      return NextResponse.json(
        {
          error:
            'The lease-template review transaction returned an invalid response.',
        },
        { status: 500 }
      );
    }

    const result =
      data as {
        success?: boolean;
        field_mapping?: unknown;
        ai_suggestions?: unknown;
      };

    if (result.success !== true) {
      console.error(
        '[LEASE TEMPLATE MAPPING REVIEW] RPC did not confirm success:',
        result
      );

      return NextResponse.json(
        {
          error:
            'The lease-template review transaction did not complete successfully.',
        },
        { status: 500 }
      );
    }

    /*
     * Return the authoritative state produced inside the locked database
     * transaction. The client must not reconstruct mapping state locally.
     */
    return NextResponse.json({
      success: true,
      auditRecorded: true,
      field_mapping: result.field_mapping ?? [],
      ai_suggestions: result.ai_suggestions ?? [],
    });
  } catch (error) {
    console.error(
      '[LEASE TEMPLATE MAPPING REVIEW] Failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to review lease-template mapping.',
      },
      { status: 500 }
    );
  }
}
