import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "NutreeNext Billing",
  description: "Restaurant billing, GST invoices, thermal printing and sales dashboard for NutreeNext.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <div className="app-main">{children}</div>
      </body>
    </html>
  );
}
