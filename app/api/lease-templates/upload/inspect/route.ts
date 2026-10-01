import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const attemptId = request.nextUrl.searchParams.get('attemptId');
  const entityId = request.nextUrl.searchParams.get('entityId');

  if (
    !attemptId ||
    !entityId ||
    !uuidPattern.test(attemptId) ||
    !uuidPattern.test(entityId)
  ) {
    return NextResponse.json(
      { error: 'Valid attemptId and entityId are required' },
      { status: 400 },
    );
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(authHeader.slice(7));

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: access, error: accessError } = await serviceClient
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (accessError) {
    return NextResponse.json(
      { error: 'Unable to verify entity access' },
      { status: 503 },
    );
  }

  if (!access) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 },
    );
  }

  const { data: canEdit, error: permissionError } =
    await serviceClient.rpc('has_entity_permission', {
      p_user_id: user.id,
      p_entity_id: entityId,
      p_permission_key: 'leasing.template.edit',
    });

  if (permissionError) {
    return NextResponse.json(
      { error: 'Unable to verify permissions' },
      { status: 503 },
    );
  }

  if (canEdit !== true) {
    return NextResponse.json(
      { error: 'Lease-template editing permission required' },
      { status: 403 },
    );
  }

  const { data: inspectionRows, error: inspectionError } =
    await serviceClient.rpc(
      'inspect_lease_template_upload_attempt',
      { p_attempt_id: attemptId },
    );

  if (inspectionError) {
    console.error(
      'Lease-template inspection failed:',
      inspectionError,
    );

    return NextResponse.json(
      { error: 'Unable to inspect upload' },
      { status: 503 },
    );
  }

  const inspection = inspectionRows?.[0];

  if (!inspection || inspection.entity_id !== entityId) {
    return NextResponse.json(
      { error: 'Upload attempt not found' },
      { status: 404 },
    );
  }

  let storageExists: boolean | null = null;
  let storageInspectionError = false;

  if (inspection.storage_key) {
    const { data: object, error: storageError } =
      await serviceClient.storage
        .from('documents')
        .info(inspection.storage_key);

    if (!storageError) {
      storageExists = object !== null;
    } else if (
      storageError.message.toLowerCase().includes('not found') ||
      storageError.message.toLowerCase().includes('not_found')
    ) {
      storageExists = false;
    } else {
      storageInspectionError = true;

      console.error(
        'Lease-template storage inspection failed:',
        {
          attemptId,
          storageError,
        },
      );
    }
  }

  return NextResponse.json({
    inspection,
    storage: {
      exists: storageExists,
      inspectionError: storageInspectionError,
    },
    readOnly: true,
  });
}
