import type { Metadata, Viewport } from "next";
import InstallAppButton from "@/app/components/install-app-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "Money Manager — Your money, in focus",
  description: "A clean personal finance dashboard for cash flow, bank balances, budgets, and investments.",
  applicationName: "Money Manager",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Money Manager",
  },
  icons: {
    apple: [{ url: "/icons/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#172c28" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<InstallAppButton /></body></html>;
}
