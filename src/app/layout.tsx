import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { readMood } from "@/lib/mood/state";
import { computeTheme, themeColor, type ThemeVars } from "@/lib/theme/compute";
import { timeContext } from "@/lib/time/awareness";
import { Providers } from "@/components/Providers";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { ServiceWorker } from "@/components/ServiceWorker";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "أنيس — رفيقك اللي بيفتكر وبيحس",
  description: "أنيس: رفيق ذكي ليه شخصية ومزاج وذاكرة، بيتكلم معاك بطبيعتك.",
  manifest: "/manifest.webmanifest",
  applicationName: "أنيس",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "أنيس" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4ead2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const DEFAULT_MOOD = {
  happiness: 0.6,
  affection: 0.55,
  annoyance: 0,
  energy: 0.6,
  intensity: 0,
  reason: null,
  safetyOverride: false,
};

/** Compute the live theme from the current user's mood + local time (or defaults). */
async function themeVars(): Promise<ThemeVars> {
  try {
    const user = await currentUser();
    if (!user) {
      return computeTheme(DEFAULT_MOOD, timeContext("Africa/Cairo").timeOfDay);
    }
    const ctx = await tenantForUser(user.id, user.role);
    const mood = await readMood(ctx.assistantId);
    return computeTheme(mood, timeContext(user.timezone).timeOfDay);
  } catch {
    return computeTheme(DEFAULT_MOOD, timeContext("Africa/Cairo").timeOfDay);
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = await themeVars();
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} style={vars as CSSProperties}>
      <head>
        <meta name="theme-color" content={themeColor(vars)} />
      </head>
      <body className="font-sans antialiased min-h-dvh transition-theme">
        <ThemeColorSync />
        <ServiceWorker />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
