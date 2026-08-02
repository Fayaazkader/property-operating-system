import { supabase } from "../supabase";

type MatchResult = {
  transactionId: string;
  matched: boolean;
  matchPriority: number | null;
  matchedTenantId: string | null;
  matchedTenantName: string | null;
  matchedInvoiceId: string | null;
  matchedLeaseId: string | null;
  confidence: number;
  matchReason: string;
};

export type ReconciliationSummary = {
  total: number;
  autoAllocated: number;
  partiallyAllocated: number;
  unallocated: number;
  results: MatchResult[];
};

async function getPropertyFromLease(leaseId: string): Promise<string | null> {
  if (!leaseId) return null;
  const { data } = await supabase
    .from("leases")
    .select("property_id")
    .eq("id", leaseId)
    .single();
  return data?.property_id || null;
}

async function getPropertyFromTenant(tenantId: string): Promise<string | null> {
  if (!tenantId) return null;
  const { data } = await supabase
    .from("leases")
    .select("property_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  return data?.property_id || null;
}

export async function runReconciliationEngine(
  entityId: string
): Promise<ReconciliationSummary> {
  // Filter transactions by entity via bank account
  const { data: entityAccounts } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("entity_id", entityId);
  
  const accountIds = (entityAccounts || []).map(a => a.id);
  
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .in("bank_account_id", accountIds)
    .eq("allocation_status", "unallocated")
    .order("transaction_date", { ascending: false })
    .limit(500);

  const { data: transactions } = await query;

  if (!transactions || transactions.length === 0) {
    return { total: 0, autoAllocated: 0, partiallyAllocated: 0, unallocated: 0, results: [] };
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, tenant_name")
    .eq("entity_id", entityId);

  const { data: leases } = await supabase
    .from("leases")
    .select("id, lease_id, tenant_id, property_id");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, tenant_id, lease_id, total_amount")
    .neq("payment_status", "paid");

  const results: MatchResult[] = [];

  for (const tx of transactions) {
    const ref = (tx.transaction_reference || "").toUpperCase().trim();
    const desc = (tx.transaction_description || "").toUpperCase().trim();
    const amount = Math.abs(tx.transaction_amount || 0);
    const searchText = `${ref} ${desc}`;

    let matched = false;
    let matchPriority: number | null = null;
    let matchedTenantId: string | null = null;
    let matchedTenantName: string | null = null;
    let matchedInvoiceId: string | null = null;
    let matchedLeaseId: string | null = null;
    let confidence = 0;
    let matchReason = "";

    // Priority 1: Tenant ID in reference
    if (!matched && tenants) {
      for (const tenant of tenants) {
        if (tenant.id && searchText.includes(tenant.id.slice(0, 8).toUpperCase())) {
          matched = true;
          matchPriority = 1;
          matchedTenantId = tenant.id;
          matchedTenantName = tenant.tenant_name;
          confidence = 100;
          matchReason = `Tenant ID found in reference`;
          break;
        }
      }
    }

    // Priority 2: Tenant name in reference
    if (!matched && tenants) {
      for (const tenant of tenants) {
        if (tenant.tenant_name && searchText.includes(tenant.tenant_name.toUpperCase())) {
          matched = true;
          matchPriority = 2;
          matchedTenantId = tenant.id;
          matchedTenantName = tenant.tenant_name;
          confidence = 95;
          matchReason = `Tenant name "${tenant.tenant_name}" found in reference`;
          break;
        }
      }
    }

    // Priority 3: Invoice number in reference
    if (!matched && invoices) {
      for (const inv of invoices) {
        if (inv.invoice_number && searchText.includes(inv.invoice_number.toUpperCase())) {
          matched = true;
          matchPriority = 3;
          matchedInvoiceId = inv.id;
          matchedTenantId = inv.tenant_id;
          matchedLeaseId = inv.lease_id;
          confidence = 100;
          matchReason = `Invoice ${inv.invoice_number} found in reference`;
          break;
        }
      }
    }

    // Priority 4: Lease number in reference
    if (!matched && leases) {
      for (const lease of leases) {
        if (lease.lease_id && searchText.includes(lease.lease_id.toUpperCase())) {
          matched = true;
          matchPriority = 4;
          matchedLeaseId = lease.id;
          matchedTenantId = lease.tenant_id;
          confidence = 90;
          matchReason = `Lease ${lease.lease_id} found in reference`;
          break;
        }
      }
    }

    // Priority 5: Amount matches open invoice
    if (!matched && invoices) {
      for (const inv of invoices) {
        if (Math.abs((inv.total_amount || 0) - amount) < 1) {
          matched = true;
          matchPriority = 5;
          matchedInvoiceId = inv.id;
          matchedTenantId = inv.tenant_id;
          matchedLeaseId = inv.lease_id;
          confidence = 80;
          matchReason = `Amount R${amount} matches invoice ${inv.invoice_number}`;
          break;
        }
      }
    }

    // Priority 6: AI fuzzy match
    if (!matched && tenants) {
      let bestScore = 0;
      let bestTenant: any = null;

      for (const tenant of tenants) {
        if (!tenant.tenant_name) continue;
        const nameParts = tenant.tenant_name.toUpperCase().split(" ");
        const matchingParts = nameParts.filter((part: string) => {
          return part.length > 2 && searchText.includes(part);
        });
        const score = matchingParts.length / nameParts.length;

        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestTenant = tenant;
        }
      }

      if (bestTenant) {
        matched = true;
        matchPriority = 6;
        matchedTenantId = bestTenant.id;
        matchedTenantName = bestTenant.tenant_name;
        confidence = Math.round(bestScore * 70);
        matchReason = `AI fuzzy match: "${bestTenant.tenant_name}" (${confidence}%)`;
      }
    }

    // Get property_id from lease or tenant
    let propertyId: string | null = null;
    if (matchedLeaseId) {
      propertyId = await getPropertyFromLease(matchedLeaseId);
    }
    if (!propertyId && matchedTenantId) {
      propertyId = await getPropertyFromTenant(matchedTenantId);
    }

    // Update transaction
    if (matched && matchPriority && matchPriority <= 4) {
      await supabase
        .from("bank_transactions")
        .update({
          matched_tenant_id: matchedTenantId,
          matched_invoice_id: matchedInvoiceId,
          property_id: propertyId,
          allocation_status: "fully_allocated",
          queue: "ready",
          reconciliation_notes: matchReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
    } else if (matched) {
      await supabase
        .from("bank_transactions")
        .update({
          matched_tenant_id: matchedTenantId,
          matched_invoice_id: matchedInvoiceId,
          property_id: propertyId,
          allocation_status: "unallocated",
          queue: "ready",
          reconciliation_notes: matchReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
    } else {
      matchReason = "No match found";
    }

    // Save match result to database
    if (matched && matchedTenantId) {
      await supabase.from("bank_transactions").update({
        matched_tenant_id: matchedTenantId,
        matched_tenant_name: matchedTenantName,
        matched_invoice_id: matchedInvoiceId,
        confidence: confidence,
        allocation_status: "fully_allocated",
        queue: "ready"
      }).eq("id", tx.id);
    }

    results.push({
      transactionId: tx.id,
      matched,
      matchPriority,
      matchedTenantId,
      matchedTenantName,
      matchedInvoiceId,
      matchedLeaseId,
      confidence,
      matchReason,
    });
  }

  const autoAllocated = results.filter(r => r.matched && r.matchPriority && r.matchPriority <= 4).length;
  const partiallyAllocated = results.filter(r => r.matched && r.matchPriority && r.matchPriority > 4).length;
  const unallocated = results.filter(r => !r.matched).length;

  return {
    total: results.length,
    autoAllocated,
    partiallyAllocated,
    unallocated,
    results,
  };
}