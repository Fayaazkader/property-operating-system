// app/api/property/assets/route.ts
import { NextRequest } from "next/server";
import { propertyOrchestrator } from "@/lib/property-operations";
import { getPlatformContext } from "@/lib/platform/context";
import { validateRequired } from "@/lib/platform/validation";
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse } from "@/lib/platform/api-response";

export async function GET(request: NextRequest) {
  try {
    const context = await getPlatformContext(request);
    const result = await propertyOrchestrator.listAssets(context.entityId);
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
      { field: 'property_id', label: 'Property ID' },
      { field: 'name', label: 'Asset name' },
      { field: 'type', label: 'Asset type' },
    ]);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors, context.correlationId);
    }
    const result = await propertyOrchestrator.createAsset({
      property_id: body.property_id,
      building_id: body.building_id,
      floor: body.floor,
      zone: body.zone,
      space: body.space,
      name: body.name,
      type: body.type,
      serial_number: body.serial_number,
      model: body.model,
      manufacturer: body.manufacturer,
      installation_date: body.installation_date,
      warranty_expiry: body.warranty_expiry,
      expected_life_years: body.expected_life_years,
      replacement_value: body.replacement_value,
      service_interval_days: body.service_interval_days,
      preferred_supplier_id: body.preferred_supplier_id,
      location_notes: body.location_notes,
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
