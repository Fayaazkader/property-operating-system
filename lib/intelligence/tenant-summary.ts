export type TenantSummary = {
  tenant_id: string;
  tenant_name: string;
  current_balance: number;
  lease_id: string | null;
  lease_status: string | null;
  expiry_date: string | null;
  property_name: string | null;
  last_statement_period: string | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
};

export async function getTenantSummary(supabase: any, tenantId: string): Promise<TenantSummary | null> {
  const { data: tenant } = await supabase.from("tenants").select("id, tenant_name").eq("id", tenantId).single();
  if (!tenant) return null;

  const { data: lease } = await supabase
    .from("leases")
    .select("id, lease_status, lease_end_date, monthly_rental, properties(property_name)")
    .eq("tenant_id", tenantId)
    .eq("lease_status", "Active")
    .order("lease_start_date", { ascending: false })
    .limit(1)
    .single();

  const { data: charges } = await supabase.from("charges").select("amount_incl_vat").eq("tenant_id", tenantId);
  const totalCharges = charges?.reduce((sum: number, c: any) => sum + (c.amount_incl_vat || 0), 0) || 0;

  const { data: payments } = await supabase.from("bank_transactions").select("transaction_amount").eq("matched_tenant_id", tenantId);
  const totalPayments = payments?.reduce((sum: number, p: any) => sum + Math.abs(p.transaction_amount || 0), 0) || 0;

  const { data: lastStatement } = await supabase
    .from("communications")
    .select("source_id")
    .eq("tenant_id", tenantId)
    .eq("event_type", "statement_available")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: lastPayment } = await supabase
    .from("bank_transactions")
    .select("transaction_date, transaction_amount")
    .eq("matched_tenant_id", tenantId)
    .order("transaction_date", { ascending: false })
    .limit(1)
    .single();

  return {
    tenant_id: tenant.id,
    tenant_name: tenant.tenant_name,
    current_balance: totalCharges - totalPayments,
    lease_id: lease?.id || null,
    lease_status: lease?.lease_status || null,
    expiry_date: lease?.lease_end_date || null,
    property_name: (lease as any)?.properties?.property_name || null,
    last_statement_period: lastStatement?.source_id || null,
    last_payment_date: lastPayment?.transaction_date || null,
    last_payment_amount: lastPayment?.transaction_amount || null,
  };
}
