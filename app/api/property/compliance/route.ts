// app/api/property/compliance/route.ts
import { NextRequest } from "next/server";
import { propertyOrchestrator } from "@/lib/property-operations";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const expiring = searchParams.get('expiring') === 'true';
    let result;
    if (expiring) {
      result = await propertyOrchestrator.listComplianceExpiringSoon(context.entityId);
    } else {
      result = await propertyOrchestrator.listCompliance(context.entityId, { status, type });
    }
    if (result.error) {
      return errorResponse(result.error.code, result.error.message, context.correlationId);
    }
    return successResponse(result.data, context.correlationId);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse(correlationId);
    }
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', correlationId, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const body = await request.json();
    const validation = validateRequired(body, [
      { field: 'property_id', label: 'Property ID' },
      { field: 'name', label: 'Compliance name' },
      { field: 'type', label: 'Compliance type' },
      { field: 'expiry_date', label: 'Expiry date' },
    ]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }
    const result = await propertyOrchestrator.createCompliance({
      property_id: body.property_id,
      asset_id: body.asset_id,
      name: body.name,
      type: body.type,
      reference_number: body.reference_number,
      issuing_authority: body.issuing_authority,
      issue_date: body.issue_date,
      expiry_date: body.expiry_date,
      reminder_days: body.reminder_days || 30,
      document_url: body.document_url,
    }, context.entityId);
    if (result.error) {
      return errorResponse(result.error!.code, result.error!.message, context.correlationId);
    }
    return successResponse(result.data, context.correlationId);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse(correlationId);
    }
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', correlationId, 500);
  }
}
