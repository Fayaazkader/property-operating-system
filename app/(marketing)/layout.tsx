import type { Metadata } from 'next';
import { marketing } from '@/lib/marketing.config';
import { marketingAssets } from '@/lib/marketingAssets';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import '@/styles/marketing.css';

export const metadata: Metadata = {
  title: { default: `${marketing.company.name} — ${marketing.company.tagline}`, template: `%s — ${marketing.company.name}` },
  description: marketing.company.description,
  openGraph: { title: `${marketing.company.name} — ${marketing.company.tagline}`, description: marketing.company.description, images: [{ url: marketingAssets.ogImage, width: 1200, height: 630 }] },
};

export default function MarketingRouteLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
