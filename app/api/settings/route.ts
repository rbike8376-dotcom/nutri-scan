import { NextResponse } from "next/server";
import { getAppSettings, toPublicSettings } from "@/lib/settings";

// Public site settings — only the consumer-safe subset, plus ETag-ish no-store semantics.
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(toPublicSettings(settings), {
    headers: { "Cache-Control": "no-store" },
  });
}
