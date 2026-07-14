// app/api/brokerage/offers/route.ts
// Offers API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";
import { offerService } from "@/lib/brokerage/offers/offer.service";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;
    const vacancyId = searchParams.get('vacancyId');

    if (!vacancyId) {
      return errorResponse('MISSING_PARAM', 'vacancyId is required', context.correlationId);
    }

    const result = await offerService.listByVacancy(vacancyId);

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
      { field: 'vacancy_id', label: 'Vacancy ID' },
      { field: 'offer_date', label: 'Offer date' },
      { field: 'proposed_rental', label: 'Proposed rental' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }

    const result = await brokerageOrchestrator.createOfferWithNegotiation({
      vacancy_id: body.vacancy_id,
      enquiry_id: body.enquiry_id,
      broker_id: body.broker_id,
      offer_date: body.offer_date,
      proposed_rental: body.proposed_rental,
      proposed_deposit: body.proposed_deposit,
      proposed_term: body.proposed_term,
      proposed_commencement: body.proposed_commencement,
      special_conditions: body.special_conditions,
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
