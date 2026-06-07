import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ReconciliationWorkspace } from "./reconciliation-workspace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { transactionId } = await params;
  const { data: encodedData } = await searchParams;

  // Try database first
  const { data: transaction, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  // Fall back to passed data if DB lookup fails
  let resolvedTransaction = transaction;
  if (error && encodedData) {
    resolvedTransaction = JSON.parse(decodeURIComponent(encodedData));
  }

  if (!resolvedTransaction) {
    notFound();
  }

  const [
    { data: properties },
    { data: leases },
    { data: tenants },
  ] = await Promise.all([
    supabase.from("properties").select("id, property_name, property_code").order("property_name"),
    supabase.from("leases").select("id, lease_id, property_id, tenant_id, tenant_name").order("lease_id"),
    supabase.from("tenants").select("id, tenant_name, tenant_code").order("tenant_name"),
  ]);

  return (
    <ReconciliationWorkspace
      transaction={resolvedTransaction}
      lookupData={{
        properties: properties || [],
        leases: leases || [],
        tenants: tenants || [],
      }}
    />
  );
}