import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-ignore: Node 24 requires the explicit .ts extension for native TypeScript execution.
import { requireTransactionDate } from "./transaction-date.ts";

test("accepts the final day of September", () => {
  assert.equal(requireTransactionDate("2026-09-30"), "2026-09-30");
});

test("preserves September accounting date when imported in October", () => {
  const transactionDate = "2026-09-30";
  const importDate = "2026-10-04";

  assert.equal(requireTransactionDate(transactionDate), "2026-09-30");
  assert.notEqual(requireTransactionDate(transactionDate), importDate);
});

test("accepts an October transaction date", () => {
  assert.equal(requireTransactionDate("2026-10-01"), "2026-10-01");
});

test("rejects impossible calendar dates", () => {
  assert.throws(() => requireTransactionDate("2026-09-31"));
});

test("rejects missing transaction dates", () => {
  assert.throws(() => requireTransactionDate(null));
  assert.throws(() => requireTransactionDate(""));
});
