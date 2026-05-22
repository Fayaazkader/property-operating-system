import "./globals.css";

import Sidebar from "./components/Sidebar";

export const metadata = {

  title: "Property OS",

  description:
    "Enterprise Property Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (

    <html lang="en">

      <body className="bg-gray-100">

        <div className="flex min-h-screen">

          <Sidebar />

          <main className="flex-1">

            <div className="p-6">

              <div className="bg-white rounded-2xl shadow-sm min-h-[95vh]">

                {children}

              </div>

            </div>

          </main>

        </div>

      </body>

    </html>
  );
}