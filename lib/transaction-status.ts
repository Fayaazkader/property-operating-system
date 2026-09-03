// Single source of truth for bank transaction allocation,
// posting and operational queue state.

export type AllocationStatus =
  | "unallocated"
  | "partially_allocated"
  | "fully_allocated";

export type PostingStatus =
  | "not_posted"
  | "posting"
  | "posted"
  | "posting_failed";

export type Queue =
  | "ready"
  | "review"
  | "exceptions"
  | "posted";

type TransactionState = {
  allocation_status: AllocationStatus;
  posting_status?: PostingStatus | null;
  queue: Queue;
  confidence?: number;
  matched_tenant_id?: string | null;
};

export function isReady(tx: TransactionState): boolean {
  return (
    tx.queue === "ready" &&
    tx.allocation_status === "fully_allocated" &&
    tx.posting_status !== "posted"
  );
}

export function isReview(tx: TransactionState): boolean {
  return (
    tx.queue === "review" &&
    tx.posting_status !== "posted"
  );
}

export function isException(tx: TransactionState): boolean {
  return (
    tx.queue === "exceptions" &&
    tx.posting_status !== "posted"
  );
}

export function isPosted(tx: TransactionState): boolean {
  return (
    tx.posting_status === "posted" ||
    tx.queue === "posted"
  );
}

export function isInQueue(
  tx: TransactionState,
  queue: Queue
): boolean {
  switch (queue) {
    case "ready":
      return isReady(tx);

    case "review":
      return isReview(tx);

    case "exceptions":
      return isException(tx);

    case "posted":
      return isPosted(tx);

    default:
      return false;
  }
}