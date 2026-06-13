import "./globals.css";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import { PlatformProvider } from "./context/PlatformContext";


export const metadata = {
  title: "Property OS",
  description: "Enterprise Property Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (

    <html lang="en">

      <body className="bg-black text-white">
        <PlatformProvider>


        <div className="flex h-screen overflow-hidden bg-black">

          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-zinc-950">

            <div className="p-5 lg:p-6">

              <div className="min-h-full rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">

                <Navbar />

                <div className="bg-zinc-950 min-h-[calc(95vh-80px)]">

                  {children}

                </div>

              </div>

            </div>

          </main>

        </div>

      </PlatformProvider>

</body>

</html>
  );
}