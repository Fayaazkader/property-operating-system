export type TenantBalance = {
  balance_bf: number;
  current_charges: number;
  receipts: number;
  balance_cf: number;
};

export async function getTenantBalance(supabase: any, tenantId: string): Promise<TenantBalance> {
  const { data: charges } = await supabase.from("charges").select("amount_incl_vat").eq("tenant_id", tenantId);
  const currentCharges = charges?.reduce((sum: number, c: any) => sum + (c.amount_incl_vat || 0), 0) || 0;

  const { data: payments } = await supabase.from("bank_transactions").select("transaction_amount").eq("matched_tenant_id", tenantId);
  const receipts = payments?.reduce((sum: number, p: any) => sum + Math.abs(p.transaction_amount || 0), 0) || 0;

  return {
    balance_bf: 0,
    current_charges: currentCharges,
    receipts,
    balance_cf: currentCharges - receipts,
  };
}
