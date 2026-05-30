import { NextResponse } from "next/server";
import { pushPublicKey } from "@/lib/push/send";

export async function GET() {
  return NextResponse.json({ key: pushPublicKey() });
}
