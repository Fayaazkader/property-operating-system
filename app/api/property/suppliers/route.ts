// app/api/property/suppliers/route.ts
import { NextRequest } from "next/server";
import { propertyOrchestrator } from "@/lib/property-operations";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const result = await propertyOrchestrator.listSuppliers(context.entityId, { category });
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
    const validation = validateRequired(body, [{ field: 'name', label: 'Supplier name' }]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }
    const result = await propertyOrchestrator.createSupplier({
      name: body.name,
      registration_number: body.registration_number,
      vat_number: body.vat_number,
      contact_person: body.contact_person,
      email: body.email,
      phone: body.phone,
      whatsapp_number: body.whatsapp_number,
      address: body.address,
      categories: body.categories || [],
      payment_terms_days: body.payment_terms_days || 30,
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
