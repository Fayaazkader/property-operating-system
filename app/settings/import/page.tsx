"use client";
import { PageHeader } from "@/app/components/layout/PageHeader";

export default function ImportPage() {
  const templates = [
    { name: "Properties", headers: "property_name,property_code,entity_id,property_type,address_line_1,city,province,country,total_gla_sqm" },
    { name: "Tenants", headers: "tenant_name,company_registration,vat_number,contact_person,email,phone,industry" },
    { name: "Leases", headers: "lease_id,tenant_name,property_name,monthly_rental,escalation_percent,deposit_amount,parking_bays,lease_start_date,lease_end_date" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Data Import" subtitle="Download templates and import your existing data." />
      <div className="space-y-4">
        {templates.map(t => (
          <div key={t.name} className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t.name} Template</p>
            <p className="text-xs text-[var(--text-muted)] font-mono mb-4">{t.headers}</p>
            <button
              onClick={() => {
                const blob = new Blob([t.headers], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${t.name.toLowerCase()}_template.csv`;
                a.click();
              }}
              className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]"
            >
              Download {t.name} CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}