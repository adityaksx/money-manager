import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Manager — Your money, in focus",
  description: "A clean personal finance dashboard for cash flow, bank balances, budgets, and investments.",
  applicationName: "Money Manager",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f8fa" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
