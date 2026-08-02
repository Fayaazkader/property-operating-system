// lib/signing/coordinate-transform-service.ts
// Transforms between normalized coordinates (storage) and pixels (rendering)

import { toPixels, toNormalised } from './coordinates';

export interface CanvasField {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Single field: storage → pixels
export function fieldToPixels(field: CanvasField, pageDims: { width: number; height: number }): CanvasField {
  const px = toPixels({ x: field.x, y: field.y, w: field.width, h: field.height }, pageDims.width, pageDims.height);
  return { ...field, x: px.x, y: px.y, width: px.width, height: px.height };
}

// Multiple fields: storage → pixels
export function fieldsToPixels(fields: CanvasField[], pageDims: { width: number; height: number }): CanvasField[] {
  return fields.map(f => fieldToPixels(f, pageDims));
}

// Single field: pixels → storage
export function toStorageCoordinates(field: CanvasField, pageDims: { width: number; height: number }): CanvasField {
  const norm = toNormalised(field.x, field.y, field.width, field.height, pageDims.width, pageDims.height);
  return { ...field, x: norm.x, y: norm.y, width: norm.w, height: norm.h };
}
