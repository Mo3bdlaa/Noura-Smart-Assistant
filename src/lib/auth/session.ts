import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

export type SessionData = {
  userId?: string;
  sessionId?: string; // row id in `sessions` table, for revocation
  role?: "admin" | "user";
};

const password = process.env.SESSION_SECRET;
if (!password || password.length < 32) {
  // Fail fast in any runtime that imports this without a proper secret.
  throw new Error("SESSION_SECRET must be set and at least 32 characters");
}

export const sessionOptions = {
  password,
  cookieName: "noura_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

/** Read/write the sealed session cookie (server-side only). */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
