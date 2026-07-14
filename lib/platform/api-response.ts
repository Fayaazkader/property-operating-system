// lib/platform/api-response.ts
// Standardized API Response Contract

import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string;
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  correlationId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(
  data: T,
  correlationId: string,
  metadata?: Record<string, any>
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    correlationId,
    metadata,
  });
}

export function errorResponse(
  code: string,
  message: string,
  correlationId: string,
  status: number = 400,
  details?: Record<string, any>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      correlationId,
    },
    { status }
  );
}

export function unauthorizedResponse(correlationId: string): NextResponse<ApiErrorResponse> {
  return errorResponse('UNAUTHORIZED', 'Unauthorized', correlationId, 401);
}

export function validationErrorResponse(
  errors: { field: string; message: string }[],
  correlationId: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    'VALIDATION_ERROR',
    'Validation failed',
    correlationId,
    400,
    { errors }
  );
}
