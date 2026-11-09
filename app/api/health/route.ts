import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini";
import { isSheetsConfigured } from "@/lib/sheets";
import { adminConfigured } from "@/lib/admin";

// Uptime/readiness probe — safe to hit publicly; returns only boolean booleans, never secrets.
export async function GET() {
  return NextResponse.json({ status: "ok", ai: isGeminiConfigured(), sheets: isSheetsConfigured(), admin: adminConfigured() });
}
