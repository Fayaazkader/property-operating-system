// app/api/brokerage/offers/[id]/accept/route.ts
// Accept Offer API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const platformContext = await getPlatformContext(req);
    const body = await req.json();

    const validation = validateRequired(body, [
      { field: 'final_rental', label: 'Final rental' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, platformContext.correlationId);
    }

    const result = await brokerageOrchestrator.acceptOffer(id, body.final_rental, body.final_terms, platformContext.correlationId);

    if (!result.success) {
      return errorResponse(result.error!.code, result.error!.message, platformContext.correlationId);
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
