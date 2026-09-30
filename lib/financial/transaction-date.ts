/**
 * Returns the calendar date of a financial transaction.
 *
 * The accounting date comes from the transaction itself,
 * never its import date or the current financial period.
 *
 * Timestamp inputs must already use the authoritative
 * transaction's calendar date.
 */
export function requireTransactionDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Financial transaction date is required");
  }

  const date = value.slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid financial transaction date");
  }

  return date;
}
