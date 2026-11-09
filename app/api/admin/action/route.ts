import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin";
import { deleteScan, deleteAllUserData, setUserConsent, logAdminAction } from "@/lib/sheets";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deleteScan"), userId: z.string().min(1).max(80), scanId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("deleteAllUserData"), userId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("toggleConsent"), userId: z.string().min(1).max(80), consent: z.boolean() }),
]);

export async function POST(req: NextRequest) {
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 400 });

  const data = parsed.data;
  try {
    if (data.action === "deleteScan") {
      const ok = await deleteScan(data.userId, data.scanId);
      await logAdminAction("deleteScan", `user=${data.userId} scan=${data.scanId} ok=${ok}`);
      return NextResponse.json({ ok });
    }
    if (data.action === "deleteAllUserData") {
      const deleted = await deleteAllUserData(data.userId);
      await logAdminAction("deleteAllUserData", `user=${data.userId} -> ${JSON.stringify(deleted)}`);
      return NextResponse.json({ ok: true, deleted });
    }
    // toggleConsent
    const ok = await setUserConsent(data.userId, data.consent);
    await logAdminAction("toggleConsent", `user=${data.userId} -> ${data.consent} ok=${ok}`);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("[admin/action] failed:", err);
    return NextResponse.json({ error: "Action failed — see server logs." }, { status: 500 });
  }
}
