// app/api/property/work-orders/[id]/route.ts
import { NextRequest } from "next/server";
import { propertyOrchestrator } from "@/lib/property-operations";
import { getPlatformContext } from "@/lib/platform/context";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const platformContext = await getPlatformContext(req);
    const result = await propertyOrchestrator.getWorkOrder(id);
    if (result.error) {
      return errorResponse(result.error.code, result.error.message, platformContext.correlationId);
    }
    return successResponse(result.data, platformContext.correlationId);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse(correlationId);
    }
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', correlationId, 500);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const platformContext = await getPlatformContext(req);
    const body = await req.json();
    const result = await propertyOrchestrator.updateWorkOrder(id, body);
    if (result.error) {
      return errorResponse(result.error.code, result.error.message, platformContext.correlationId);
    }
    return successResponse(result.data, platformContext.correlationId);
  } catch (error) {
    const correlationId = crypto.randomUUID();
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse(correlationId);
    }
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', correlationId, 500);
  }
}
