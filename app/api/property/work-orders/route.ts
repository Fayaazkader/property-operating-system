// app/api/property/work-orders/route.ts
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
    const priority = searchParams.get('priority') || undefined;
    const result = await propertyOrchestrator.listWorkOrders(context.entityId, { status, priority });
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
      { field: 'title', label: 'Title' },
    ]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }
    const result = await propertyOrchestrator.createWorkOrder({
      property_id: body.property_id,
      unit_id: body.unit_id,
      tenant_id: body.tenant_id,
      asset_id: body.asset_id,
      inspection_id: body.inspection_id,
      title: body.title,
      description: body.description,
      priority: body.priority || 'medium',
      assigned_to: body.assigned_to,
      source: body.source || 'tenant',
      source_id: body.source_id,
      estimated_cost: body.estimated_cost,
      tenant_notes: body.tenant_notes,
    }, context.entityId);
    if (!result.success) {
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
