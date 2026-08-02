// lib/signing/canvas-service.ts
// Handles coordinate conversion. DocumentViewer only renders pixels.

import { toPixels, toNormalised } from './coordinates';

export interface CanvasField {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Database → Pixels (for rendering)
export function fieldsToPixels(fields: CanvasField[], pageDims: { width: number; height: number }): CanvasField[] {
  return fields.map(f => {
    const px = toPixels({ x: f.x, y: f.y, w: f.width, h: f.height }, pageDims.width, pageDims.height);
    return { ...f, x: px.x, y: px.y, width: px.width, height: px.height };
  });
}

// Pixels → Database (for saving)
export function pixelFieldToNormalised(field: CanvasField, pageDims: { width: number; height: number }): CanvasField {
  const norm = toNormalised(field.x, field.y, field.width, field.height, pageDims.width, pageDims.height);
  return { ...field, x: norm.x, y: norm.y, width: norm.w, height: norm.h };
}
