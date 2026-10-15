/** Canonical PDF placement contract, shared by preparation UI and finalisation.
 * Page numbers are one-based; rectangles use normalized top-left display space.
 * Every listed field is mandatory. Signer-supplied values never define placement.
 */
export interface ExecutionField {
  id: string;
  participantId: string;
  type: 'signature' | 'initial' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ExecutionFieldManifest {
  executionId: string;
  documentVersionId: string;
  originalSha256: string;
  fields: ExecutionField[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function parseExecutionFields(value: unknown, pageCount: number, participantIds: string[]): ExecutionField[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    throw new Error('Place between 1 and 500 signing fields.');
  }
  const ids = new Set<string>();
  const signed = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).length !== 8) {
      throw new Error('Invalid signing field.');
    }
    const field = item as ExecutionField;
    if (typeof field.id !== 'string' || !UUID.test(field.id) || ids.has(field.id) ||
        !participantIds.includes(field.participantId) || !['signature', 'initial', 'date'].includes(field.type) ||
        !Number.isInteger(field.page) || field.page < 1 || field.page > pageCount ||
        ![field.x, field.y, field.width, field.height].every(n => typeof n === 'number' && Number.isFinite(n)) ||
        field.x < 0 || field.y < 0 || field.width <= 0 || field.height <= 0 ||
        field.x + field.width > 1 || field.y + field.height > 1) {
      throw new Error('Check signing field bounds, page and participant.');
    }
    ids.add(field.id);
    if (field.type === 'signature') signed.add(field.participantId);
  }
  if (!participantIds.length || participantIds.some(id => !signed.has(id))) {
    throw new Error('Place a signature field for every signatory.');
  }
  return value as ExecutionField[];
}
