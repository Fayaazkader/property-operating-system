import "./globals.css";
import { PlatformProvider } from "./context/PlatformContext";
import Script from "next/script";
import "@/lib/platform/validation/registry";
import "@/lib/platform/bootstrap";

export const metadata = {
  title: "AssetFlow | Property Operating System",
  description: "Commercial property operations, billing, communications, cash books and intelligence in one platform. Simple on top. Galaxy beneath.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8GV9CJ6VBB" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-8GV9CJ6VBB');`}
        </Script>
      </head>
      <body className="bg-black text-white">
        <PlatformProvider>
          {children}
        </PlatformProvider>
      </body>
    </html>
  );
}
