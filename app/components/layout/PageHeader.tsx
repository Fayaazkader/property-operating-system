"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  "": "Home",
  "financials": "Financials",
  "imports": "Bank Imports",
  "cash-book": "Cash Book",
  "revenue": "Revenue Ops",
  "reconciliation": "Reconciliation",
  "leases": "Leases",
  "properties": "Properties",
  "tenants": "Tenants",
  "suppliers": "Suppliers",
  "maintenance": "Maintenance",
  "documents": "Documents",
  "reports": "Reports",
  "settings": "Settings",
  "operations": "Operations",
  "executive": "Executive",
  "tasks": "Tasks",
};

type Props = {
  title?: string;
  subtitle?: string;
  context?: string;
};

export function PageHeader({ title, subtitle, context }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumbs
  const breadcrumbs: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
  ];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    // Skip dynamic segments like [transactionId]
    const isDynamic = segment.startsWith("[") || /^[0-9a-f-]{36}$/.test(segment);
    const label = isDynamic ? "Detail" : (routeLabels[segment] || segment.replace(/-/g, " "));
    breadcrumbs.push({ label, href: currentPath });
  }

  return (
    <div className="mb-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-700">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="text-zinc-300">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-white transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Title */}
      <h1 className="text-3xl font-black tracking-tight text-white">
        {title || breadcrumbs[breadcrumbs.length - 1]?.label || "Page"}
      </h1>

      {/* Subtitle + Context */}
      {(subtitle || context) && (
        <div className="flex items-center gap-4 mt-2">
          {subtitle && (
            <p className="text-lg leading-8 text-zinc-400">{subtitle}</p>
          )}
          {context && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {context}
            </span>
          )}
        </div>
      )}
    </div>
  );
}