import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { leaseTemplateService } from '@/lib/lease/templates/service';

interface RouteContext {
  params: Promise<{
    templateId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { templateId } = await params;

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
    } = await authClient.auth.getUser(accessToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: entities, error: entityError } =
  await serviceClient.rpc('auth_entities');

    if (entityError) {
      console.error(
        '[LEASE TEMPLATE APPROVE] Entity lookup failed:',
        entityError
      );

      return NextResponse.json(
        { error: 'Unable to determine authorised entity.' },
        { status: 500 }
      );
    }

    const entityId = entities?.[0];

    if (!entityId) {
      return NextResponse.json(
        { error: 'No authorised entity found.' },
        { status: 403 }
      );
    }

    const { data: access, error: accessError } =
      await serviceClient
        .from('user_entity_access')
        .select('entity_id')
        .eq('user_id', user.id)
        .eq('entity_id', entityId)
        .single();

    if (accessError || !access) {
      return NextResponse.json(
        { error: 'Access denied.' },
        { status: 403 }
      );
    }

    const { data: template, error: templateError } =
      await serviceClient
        .from('lease_templates')
        .select('*')
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
      template.status !== 'draft' ||
      template.review_status !== 'in_review'
    ) {
      return NextResponse.json(
        {
          error:
            'This lease template is not currently awaiting approval.',
        },
        { status: 409 }
      );
    }

    if (!template.source_document_id) {
      return NextResponse.json(
        {
          error:
            'A source document is required before approval.',
        },
        { status: 422 }
      );
    }

    const fields = Array.isArray(template.field_mapping)
      ? template.field_mapping
      : [];

    const missingRequiredFields = fields.filter(
      (field: {
        required?: boolean;
        value?: unknown;
        approved?: boolean;
      }) =>
        field.required &&
        (field.value === undefined ||
          field.value === null ||
          field.value === '')
    );

    if (missingRequiredFields.length > 0) {
      return NextResponse.json(
        {
          error:
            'All required fields must have values before the template can be approved.',
          missingFields: missingRequiredFields.map(
            (field: { key?: string; label?: string }) => ({
              key: field.key,
              label: field.label,
            })
          ),
        },
        { status: 422 }
      );
    }

    const approvedFields = fields.map(
      (field: {
        approved?: boolean;
        [key: string]: unknown;
      }) => ({
        ...field,
        approved: true,
      })
    );

    const { error: mappingError } = await serviceClient
      .from('lease_templates')
      .update({
        field_mapping: approvedFields,
        fields: approvedFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('entity_id', entityId)
      .eq('status', 'draft')
      .eq('review_status', 'in_review');

    if (mappingError) {
      console.error(
        '[LEASE TEMPLATE APPROVE] Field mapping update failed:',
        mappingError
      );

      return NextResponse.json(
        { error: 'Unable to save approved fields.' },
        { status: 500 }
      );
    }

    const approvedTemplate =
      await leaseTemplateService.approve(
        templateId,
        entityId,
        user.id,
        serviceClient
      );

    return NextResponse.json({
      success: true,
      template: approvedTemplate,
    });
  } catch (error) {
    console.error(
      '[LEASE TEMPLATE APPROVE] Approval failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to approve lease template.',
      },
      { status: 500 }
    );
  }
}