// app/api/property/purchase-orders/route.ts
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
    const result = await propertyOrchestrator.listPurchaseOrders(context.entityId, { status });
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
    const validation = validateRequired(body, [{ field: 'po_number', label: 'PO Number' }]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }
    const result = await propertyOrchestrator.createPurchaseOrder({
      work_order_id: body.work_order_id,
      supplier_id: body.supplier_id,
      po_number: body.po_number,
      description: body.description,
      amount: body.amount,
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
