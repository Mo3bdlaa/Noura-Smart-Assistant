import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { readMood } from "@/lib/mood/state";
import { computeTheme, type ThemeVars } from "@/lib/theme/compute";
import { timeContext } from "@/lib/time/awareness";

export const metadata: Metadata = {
  title: "نورا",
  description: "نورا — مساعدتك اللي بتفتكر وبتحس",
};

export const viewport: Viewport = {
  themeColor: "#caa14a",
  width: "device-width",
  initialScale: 1,
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
    <html lang="ar" dir="rtl" style={vars as CSSProperties}>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
