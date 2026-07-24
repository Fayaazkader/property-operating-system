import { marketingMetadata } from '@/lib/marketing.metadata';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import { MarketingHomePage } from '@/components/marketing/pages/HomePage';

export const metadata = marketingMetadata;

export default function Home() {
  return (
    <MarketingLayout>
      <MarketingHomePage />
    </MarketingLayout>
  );
}
