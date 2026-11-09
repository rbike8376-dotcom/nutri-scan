import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, logAdminPasswordWeaknessOnce, makeSessionValue, verifyAdminCredentials } from "@/lib/admin";
import { rateLimited, lockedOut, recordFailure, clearFailures } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  logAdminPasswordWeaknessOnce();
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, error: "Admin is disabled. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.local (and deploy) to enable it." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (lockedOut(`admin:${ip}`)) {
    return NextResponse.json({ ok: false, error: "Locked out after repeated failures — try again later." }, { status: 423 });
  }
  if (rateLimited(`admin:${ip}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts — wait a minute." }, { status: 429 });
  }

  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  const attempted = String(body.username ?? "").slice(0, 80);
  if (!verifyAdminCredentials(attempted, String(body.password ?? ""))) {
    if (recordFailure(`admin:${ip}`)) {
      void logAdminAction("admin.login.locked", `ip=${ip} · after 10 consecutive failures`);
      return NextResponse.json({ ok: false, error: "Locked out after repeated failures — try again later." }, { status: 423 });
    }
    // Audit the failure — never the password. Best-effort: auditing must not block login.
    void logAdminAction("admin.login.failure", `ip=${ip} · username=${attempted || "(blank)"}`);
    return NextResponse.json({ ok: false, error: "Wrong admin username or password." }, { status: 401 });
  }
  clearFailures(`admin:${ip}`);
  void logAdminAction("admin.login.success", `ip=${ip}`);
  const res = NextResponse.json({ ok: true });
  const isSecure = req.nextUrl.protocol === "https:";
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60,
    secure: isSecure, // Secure breaks delivery over plain HTTP (local dev)
  });
  return res;
}
