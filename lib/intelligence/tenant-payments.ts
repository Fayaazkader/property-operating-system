export type TenantPayment = {
  date: string;
  amount: number;
  reference: string;
};

export async function getTenantPayments(supabase: any, tenantId: string, limit = 5): Promise<TenantPayment[]> {
  const { data } = await supabase
    .from("bank_transactions")
    .select("transaction_date, transaction_amount, transaction_reference")
    .eq("matched_tenant_id", tenantId)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  return (data || []).map((p: any) => ({
    date: p.transaction_date,
    amount: Math.abs(p.transaction_amount || 0),
    reference: p.transaction_reference || "N/A",
  }));
}
