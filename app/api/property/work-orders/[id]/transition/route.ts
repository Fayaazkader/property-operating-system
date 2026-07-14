// app/api/property/work-orders/[id]/transition/route.ts
import { NextRequest } from "next/server";
import { propertyOrchestrator } from "@/lib/property-operations";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const platformContext = await getPlatformContext(req);
    const body = await req.json();
    const validation = validateRequired(body, [{ field: 'status', label: 'Status' }]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, platformContext.correlationId);
    }
    const result = await propertyOrchestrator.transitionWorkOrder(id, body.status, body.note);
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
