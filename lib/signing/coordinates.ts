// lib/signing/coordinates.ts
// Normalised coordinates — ratios of page dimensions, not pixels

export interface NormalisedRect {
  x: number;   // 0.0–1.0 (percentage of page width)
  y: number;   // 0.0–1.0 (percentage of page height)
  w: number;   // 0.0–1.0
  h: number;   // 0.0–1.0
}

export function toPixels(rect: NormalisedRect, pageWidth: number, pageHeight: number): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(rect.x * pageWidth),
    y: Math.round(rect.y * pageHeight),
    width: Math.round(rect.w * pageWidth),
    height: Math.round(rect.h * pageHeight),
  };
}

export function toNormalised(x: number, y: number, w: number, h: number, pageWidth: number, pageHeight: number): NormalisedRect {
  return {
    x: Math.round((x / pageWidth) * 10000) / 10000,
    y: Math.round((y / pageHeight) * 10000) / 10000,
    w: Math.round((w / pageWidth) * 10000) / 10000,
    h: Math.round((h / pageHeight) * 10000) / 10000,
  };
}
