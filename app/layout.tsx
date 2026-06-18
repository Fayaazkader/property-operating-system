import "./globals.css";
import { PlatformProvider } from "./context/PlatformContext";
import AppLayout from "./components/layout/AppLayout";

export const metadata = {
  title: "AssetFlow",
  description: "The Commercial Property Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <PlatformProvider>
          <AppLayout>{children}</AppLayout>
        </PlatformProvider>
      </body>
    </html>
  );
}
