import { cookies } from "next/headers";

export type Locale = "ar" | "en";

/** Read the UI locale from the `locale` cookie (server side). Defaults to Arabic. */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  return c.get("locale")?.value === "en" ? "en" : "ar";
}

export const dirFor = (l: Locale): "rtl" | "ltr" => (l === "en" ? "ltr" : "rtl");
