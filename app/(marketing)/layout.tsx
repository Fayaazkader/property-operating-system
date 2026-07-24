import { marketingMetadata } from '@/lib/marketing.metadata';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import '@/styles/marketing.css';

export const metadata = marketingMetadata;

export default function MarketingRouteLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
