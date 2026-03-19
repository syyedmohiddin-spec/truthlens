// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { EnvironmentWalls } from "@/components/ui/EnvironmentWalls";
import { AmbientScene } from "@/components/ui/AmbientScene";
import { StarMark } from "@/components/ui/StarMark";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  title: "TruthLens — AI Fact Intelligence",
  description:
    "Paste any claim. TruthLens deploys five intelligence layers to find the truth — live web search, Wikipedia, Google Fact Check database, and server-side AI synthesis.",
  metadataBase: new URL(appUrl),
  openGraph: {
    title: "TruthLens — AI Fact Intelligence",
    description: "Paste any claim. Get the truth in seconds.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-ink text-cream font-sans antialiased min-h-screen overflow-x-hidden">
        <EnvironmentWalls />
        <AmbientScene />
        <CursorGlow />
        <StarMark />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
