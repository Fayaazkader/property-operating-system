import { PageHeader } from "../components/layout/PageHeader";

export default function SuppliersPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Suppliers" subtitle="Manage your supplier database" />
      <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <p className="text-[var(--text-muted)]">Supplier management coming soon.</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">Track supplier invoices, payments, and recurring expenses.</p>
      </div>
    </div>
  );
}