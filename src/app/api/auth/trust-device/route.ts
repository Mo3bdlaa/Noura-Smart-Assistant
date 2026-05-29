import { NextResponse } from "next/server";
import { trustDevice } from "@/lib/auth/devices";
import { AuthError, requireUser } from "@/lib/auth/guard";

/** Noura offers this in chat ("want me to trust this device?"). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await trustDevice(user.id, req.headers);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "خطأ" }, { status: 500 });
  }
}
