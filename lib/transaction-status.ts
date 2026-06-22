// Single source of truth for transaction statuses and queues

export type AllocationStatus = "unallocated" | "partially_allocated" | "fully_allocated" | "posted";
export type Queue = "ready" | "review" | "exceptions" | "posted";

// Queue rules
export function isReady(tx: { allocation_status: string; queue: string; confidence?: number; matched_tenant_id?: string | null }) {
  return tx.queue !== "posted" && tx.allocation_status !== "posted" && (!!tx.matched_tenant_id || (tx.confidence || 0) >= 90);
}

export function isReview(tx: { allocation_status: string; confidence?: number; matched_tenant_id?: string | null }) {
  return tx.allocation_status !== "posted" && (tx.confidence || 0) >= 70 && (tx.confidence || 0) < 90 && !tx.matched_tenant_id;
}

export function isException(tx: { allocation_status: string; confidence?: number; matched_tenant_id?: string | null }) {
  return tx.allocation_status !== "posted" && (tx.confidence || 0) < 70 && !tx.matched_tenant_id;
}

export function isPosted(tx: { allocation_status: string; queue: string }) {
  return tx.allocation_status === "posted" || tx.queue === "posted";
}

// Queue display rules
export function isInQueue(tx: { allocation_status: string; queue: string; confidence?: number; matched_tenant_id?: string | null }, queue: Queue) {
  switch (queue) {
    case "ready": return isReady(tx);
    case "review": return isReview(tx);
    case "exceptions": return isException(tx);
    case "posted": return isPosted(tx);
    default: return false;
  }
}
