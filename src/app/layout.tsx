import type { Metadata, Viewport } from "next";
import InstallAppButton from "@/app/components/install-app-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "RupeeTrail — A clearer trail for every rupee",
  description: "Track spending, budgets, accounts, investments and fixed deposits in one private workspace.",
  applicationName: "RupeeTrail",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RupeeTrail",
  },
  icons: {
    apple: [{ url: "/icons/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#123b32" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<InstallAppButton /></body></html>;
}
