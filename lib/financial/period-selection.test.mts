import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-ignore: Node 24 requires explicit .ts extensions for native TypeScript tests.
import { selectFinancialPeriod } from "./period-selection.ts";

const september = {
  id: "sept",
  entity_id: "company-a",
  period_type: "financial",
  status: "open",
  period_start: "2026-09-01",
  period_end: "2026-09-30",
};

const october = {
  ...september,
  id: "oct",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
};

test("late import retains its September financial period", () => {
  const transactionDate = "2026-09-30";
  const importDate = "2026-10-04";

  assert.equal(
    selectFinancialPeriod("company-a", transactionDate, [september, october]),
    "sept",
  );
  assert.notEqual(transactionDate, importDate);
});

test("October transaction selects October", () => {
  assert.equal(
    selectFinancialPeriod("company-a", "2026-10-01", [september, october]),
    "oct",
  );
});

test("closed September rejects late September posting", () => {
  assert.throws(
    () =>
      selectFinancialPeriod("company-a", "2026-09-30", [
        { ...september, status: "closed" },
        october,
      ]),
    /No open financial period/,
  );
});

test("another company's period cannot be selected", () => {
  assert.throws(
    () =>
      selectFinancialPeriod("company-b", "2026-09-30", [
        september,
        october,
      ]),
    /No open financial period/,
  );
});

test("overlapping open periods are rejected", () => {
  assert.throws(
    () =>
      selectFinancialPeriod("company-a", "2026-09-30", [
        september,
        { ...september, id: "duplicate" },
      ]),
    /Overlapping financial periods/,
  );
});
