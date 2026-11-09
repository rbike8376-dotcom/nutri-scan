import { NextRequest, NextResponse } from "next/server";
import { getScanHistory, deleteScan, clearScans } from "@/lib/sheets";
import { resolveUserId } from "@/lib/auth-context";

export async function GET(req: NextRequest) {
  const { userId } = await resolveUserId(req.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  const history = await getScanHistory(userId, 50);
  return NextResponse.json({ history });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await resolveUserId(req.nextUrl.searchParams.get("userId"));
  const scanId = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!userId) return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  if (scanId) {
    const deleted = await deleteScan(userId, scanId);
    return NextResponse.json({ deleted });
  }
  const count = await clearScans(userId);
  return NextResponse.json({ deleted: count });
}
