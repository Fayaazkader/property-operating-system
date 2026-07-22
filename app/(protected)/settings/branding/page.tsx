'use client';
export default function BrandingPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Branding</h1>
        <p className="text-sm text-zinc-500 mt-1">Branding is managed under <a href="/settings/organisation" className="text-white underline">Organisation</a>. Configure your company logo, colours, and identity there.</p>
      </div>
    </div>
  );
}
