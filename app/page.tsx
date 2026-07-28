import { MarketingHomePage } from '@/components/marketing/pages/HomePage';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';

export default function Home() {
  return (
    <MarketingLayout>
      <MarketingHomePage />
    </MarketingLayout>
  );
}
