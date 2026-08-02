// lib/revenue/query-utils.ts

interface QueryResult {
  error: any;
}

export function ensureSuccessfulQueries(results: QueryResult[]): void {
  for (const result of results) {
    if (result.error) throw new Error(`Query failed: ${result.error.message}`);
  }
}
