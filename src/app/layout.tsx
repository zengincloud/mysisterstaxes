import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Sister's Taxes",
  description:
    "Free AI bookkeeping assistant for Canadian small business. Tax deductions, P&L, balance sheets, and CSV exports.",
  metadataBase: new URL("https://mysisterstaxes.vercel.app"),
  openGraph: {
    title: "My Sister's Taxes",
    description:
      "Free AI bookkeeping assistant for Canadian small business. Tax deductions, P&L, balance sheets, and CSV exports.",
    siteName: "My Sister's Taxes",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "My Sister's Taxes",
    description:
      "Free AI bookkeeping assistant for Canadian small business.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
