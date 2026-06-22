import { PageHeader } from "@/app/components/layout/PageHeader";

export default function ExecutivePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader
        title="Executive"
        subtitle="Portfolio command center. Strategic operational oversight across your entire portfolio."
      />
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <p className="text-zinc-500">Executive dashboard coming soon.</p>
      </div>
    </div>
  );
}