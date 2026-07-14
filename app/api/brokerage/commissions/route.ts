// app/api/brokerage/commissions/route.ts
// Commissions API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";
import { commissionService } from "@/lib/brokerage/commissions/commission.service";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const result = await commissionService.listByEntity(context.entityId, { status: status || undefined });

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
      { field: 'lease_id', label: 'Lease ID' },
      { field: 'commission_type', label: 'Commission type' },
      { field: 'commission_rate', label: 'Commission rate' },
      { field: 'annual_rent', label: 'Annual rent' },
      { field: 'lease_term_months', label: 'Lease term months' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }

    const result = await brokerageOrchestrator.calculateAndCreateCommission({
      broker_id: body.broker_id,
      lease_id: body.lease_id,
      mandate_id: body.mandate_id,
      vacancy_id: body.vacancy_id,
      commission_type: body.commission_type,
      commission_rate: body.commission_rate,
      annual_rent: body.annual_rent,
      lease_term_months: body.lease_term_months,
      split_percentage: body.split_percentage,
      notes: body.notes,
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
