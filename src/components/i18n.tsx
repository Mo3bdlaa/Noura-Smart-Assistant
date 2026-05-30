"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";

export type Locale = "ar" | "en";

type I18nCtx = {
  locale: Locale;
  /** pick the Arabic or English string for the current locale */
  t: (ar: string, en: string) => string;
  setLocale: (l: Locale) => void;
};

const Ctx = createContext<I18nCtx>({
  locale: "ar",
  t: (ar) => ar,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(Ctx);
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = (ar: string, en: string) => (locale === "en" ? en : ar);
  const setLocale = (l: Locale) => {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return <Ctx.Provider value={{ locale, t, setLocale }}>{children}</Ctx.Provider>;
}
