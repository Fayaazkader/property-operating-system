// app/api/brokerage/mandates/[id]/accept/route.ts
// Accept Mandate API

import { NextRequest } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const platformContext = await getPlatformContext(req);

    const result = await brokerageOrchestrator.acceptMandate(id, platformContext.correlationId);

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
