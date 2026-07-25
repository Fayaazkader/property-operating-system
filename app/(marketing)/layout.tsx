import type { Metadata } from 'next';
import Script from 'next/script';
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
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  return (
    <>
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      <MarketingLayout>{children}</MarketingLayout>
    </>
  );
}
