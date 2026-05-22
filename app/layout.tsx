import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "Property OS",
  description: "Commercial Property Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (

    <html lang="en">

      <body>

        <div className="flex">

          <Sidebar />

          <div className="flex-1 bg-gray-100 min-h-screen">

            {children}

          </div>

        </div>

      </body>

    </html>
  );
}