// app/api/brokerage/mandates/route.ts
// Mandates API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";
import { mandateService } from "@/lib/brokerage/mandates/mandate.service";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const vacancyId = searchParams.get('vacancyId');

    // Pass vacancy_id as part of options
    const result = await mandateService.list(context.entityId, { 
      vacancy_id: vacancyId || undefined 
    });

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
      { field: 'broker_id', label: 'Broker ID' },
      { field: 'vacancy_id', label: 'Vacancy ID' },
      { field: 'mandate_date', label: 'Mandate date' },
      { field: 'commission_rate', label: 'Commission rate' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }

    const result = await brokerageOrchestrator.createMandate({
      broker_id: body.broker_id,
      vacancy_id: body.vacancy_id,
      mandate_date: body.mandate_date,
      expiry_date: body.expiry_date,
      commission_rate: body.commission_rate,
      commission_type: body.commission_type || 'percentage',
      terms: body.terms,
      exclusive: body.exclusive || false,
      mandate_url: body.mandate_url,
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
