import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin";
import { getAppSettings, saveAppSettings } from "@/lib/settings";
import { logAdminAction } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }
  return NextResponse.json(await getAppSettings());
}

export async function POST(req: NextRequest) {
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { saved, settings } = await saveAppSettings(body);
  if (!saved) {
    return NextResponse.json({ error: "Google Sheets is not reachable — settings were not saved." }, { status: 503 });
  }
  await logAdminAction("updateSettings", `sheetLink=${settings.sheetLinkVisible} voice=${settings.features.voice} ask=${settings.features.ask} history=${settings.features.history}`);
  return NextResponse.json({ ok: true, settings });
}
