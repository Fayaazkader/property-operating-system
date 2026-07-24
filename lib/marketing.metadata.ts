import type { Metadata } from 'next';
import { marketing } from '@/lib/marketing.config';
import { marketingAssets } from '@/lib/marketingAssets';

export const marketingMetadata: Metadata = {
  title: { default: `${marketing.company.name} — ${marketing.company.tagline}`, template: `%s — ${marketing.company.name}` },
  description: marketing.company.description,
  openGraph: {
    title: `${marketing.company.name} — ${marketing.company.tagline}`,
    description: marketing.company.description,
    images: [{ url: marketingAssets.ogImage, width: 1200, height: 630 }],
  },
};
