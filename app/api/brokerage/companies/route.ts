// app/api/brokerage/companies/route.ts
// Broker Companies API

import { NextRequest, NextResponse } from "next/server";
import { brokerageOrchestrator } from "@/lib/brokerage";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";
import { companyService } from "@/lib/brokerage/companies/company.service";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const searchParams = request.nextUrl.searchParams;

    const result = await companyService.list(context.entityId);

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
      { field: 'name', label: 'Company name' },
    ]);

    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }

    const result = await brokerageOrchestrator.createCompany({
      name: body.name,
      registration_number: body.registration_number,
      vat_number: body.vat_number,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      default_commission_rate: body.default_commission_rate,
      default_commission_type: body.default_commission_type,
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
