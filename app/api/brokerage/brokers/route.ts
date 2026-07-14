// app/api/brokerage/brokers/route.ts
// Brokers API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";
import { brokerService } from "@/lib/brokerage/brokers/broker.service";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');

    const result = await brokerService.list(context.entityId, { company_id: companyId || undefined });

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
      { field: 'name', label: 'Broker name' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }

    const result = await brokerageOrchestrator.createBroker({
      name: body.name,
      company_id: body.company_id,
      email: body.email,
      phone: body.phone,
      employee_number: body.employee_number,
      commission_rate: body.commission_rate,
      commission_type: body.commission_type,
    }, context.entityId, context.correlationId);

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
