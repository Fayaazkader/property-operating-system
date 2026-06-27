import "./globals.css";
import { PlatformProvider } from "./context/PlatformContext";
import AppLayout from "./components/layout/AppLayout";

export const metadata = {
  title: "AssetFlow | Property Operating System",
  description: "Commercial property operations, billing, communications, cash books and intelligence in one platform. Simple on top. Galaxy beneath.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AssetFlow | Property Operating System",
    description: "Leases, billing, statements, cash books, communications — all in one operating platform.",
    url: "https://assetflow.africa",
    siteName: "AssetFlow",
    type: "website",
    images: [{ url: "https://assetflow.africa/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AssetFlow | Property Operating System",
    description: "Commercial property operations in one platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "AssetFlow",
              "description": "Commercial property operating system — leases, billing, statements, cash books, communications and intelligence in one platform.",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "url": "https://assetflow.africa",
              "offers": {
                "@type": "Offer",
                "description": "Property operations platform for landlords, property managers and managing agents."
              }
            })
          }}
        />
        <PlatformProvider>
          <AppLayout>{children}</AppLayout>
        </PlatformProvider>
      </body>
    </html>
  );
}
