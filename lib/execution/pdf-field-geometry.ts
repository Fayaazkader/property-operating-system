import type { PDFPage, PDFFont } from 'pdf-lib';
import type { ExecutionField } from './field-manifest';

/** Resolve displayed crop-box coordinates without changing the original page. */
export function executionFieldGeometry(page: PDFPage, field: ExecutionField) {
  const crop = page.getCropBox();
  const media = page.getMediaBox();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(angle) ||
      ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
      crop.width <= 0 || crop.height <= 0 || crop.x < media.x || crop.y < media.y ||
      crop.x + crop.width > media.x + media.width || crop.y + crop.height > media.y + media.height) {
    throw new Error('Unsupported PDF page geometry');
  }
  const displayWidth = angle % 180 ? crop.height : crop.width;
  const displayHeight = angle % 180 ? crop.width : crop.height;
  const width = field.width * displayWidth;
  const height = field.height * displayHeight;
  const u = field.x * displayWidth;
  const v = (1 - field.y - field.height) * displayHeight;
  // Map displayed bottom-left to native PDF coordinates, retaining /Rotate.
  const point = (du: number, dv: number) => {
    const a = u + du, b = v + dv;
    const [x, y] = angle === 0 ? [a, b] : angle === 90 ? [crop.width - b, a]
      : angle === 180 ? [crop.width - a, crop.height - b] : [b, crop.height - a];
    return { x: crop.x + x, y: crop.y + y };
  };
  return { width, height, angle, point };
}

export function executionDateFontSize(font: PDFFont, text: string, width: number, height: number) {
  const size = Math.min(12, height / 1.3, width / font.widthOfTextAtSize(text,1));
  if (size < 6) throw new Error('Date field is too small to render legibly');
  return size;
}
