import { cookies } from "next/headers";
import type { ThemePref } from "./compute";

/** Read the user's theme preference from the `theme` cookie (default auto). */
export async function getThemePref(): Promise<ThemePref> {
  const c = await cookies();
  const v = c.get("theme")?.value;
  return v === "light" || v === "dark" ? v : "auto";
}
