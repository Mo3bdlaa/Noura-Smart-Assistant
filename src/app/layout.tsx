import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { readMood } from "@/lib/mood/state";
import { computeTheme, resolveDark, themeColor, type ThemeVars } from "@/lib/theme/compute";
import { getThemePref } from "@/lib/theme/pref";
import { timeContext } from "@/lib/time/awareness";
import { getLocale, dirFor } from "@/lib/i18n";
import { Providers } from "@/components/Providers";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { ServiceWorker } from "@/components/ServiceWorker";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SplashScreen } from "@/components/SplashScreen";

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
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
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
  closeness: 0.2,
};

/** Compute the live theme from the current user's mood + local time + dark-mode pref. */
async function themeVars(): Promise<ThemeVars> {
  const pref = await getThemePref();
  try {
    const user = await currentUser();
    if (!user) {
      const tod = timeContext("Africa/Cairo").timeOfDay;
      return computeTheme(DEFAULT_MOOD, tod, resolveDark(pref, tod));
    }
    const ctx = await tenantForUser(user.id, user.role);
    const mood = await readMood(ctx.assistantId);
    const tod = timeContext(user.timezone).timeOfDay;
    return computeTheme(mood, tod, resolveDark(pref, tod));
  } catch {
    const tod = timeContext("Africa/Cairo").timeOfDay;
    return computeTheme(DEFAULT_MOOD, tod, resolveDark(pref, tod));
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = await themeVars();
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} className={cairo.variable} style={vars as CSSProperties}>
      <head>
        <meta name="theme-color" content={themeColor(vars)} />
      </head>
      <body className="font-sans antialiased min-h-dvh transition-theme">
        <ThemeColorSync />
        <ServiceWorker />
        <SplashScreen />
        <Providers locale={locale}>
          {children}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
