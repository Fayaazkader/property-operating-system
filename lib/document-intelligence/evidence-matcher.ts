import type { DocumentEvidence } from './ocr-adapter';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}@.+/%-]+/gu, ' ')
    .trim();
}

function scoreMatch(
  value: string,
  evidenceText: string
): number {
  const target = normalize(value);
  const candidate = normalize(evidenceText);

  if (!target || !candidate) return 0;

  if (candidate === target) return 100;

  if (candidate.includes(target)) return 95;

  if (target.includes(candidate)) return 90;

  const targetTokens = target.split(' ').filter(Boolean);
  const candidateTokens = new Set(
    candidate.split(' ').filter(Boolean)
  );

  if (!targetTokens.length) return 0;

  const matched = targetTokens.filter(token =>
    candidateTokens.has(token)
  ).length;

  return Math.round(
    (matched / targetTokens.length) * 80
  );
}

export function matchEvidence(
  value: string | number | undefined,
  evidence: DocumentEvidence[]
): DocumentEvidence[] {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return [];
  }

  const target = String(value);

  return evidence
    .map(item => ({
      item,
      score: scoreMatch(target, item.text),
    }))
    .filter(result => result.score >= 70)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);
}