import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, logAdminPasswordWeaknessOnce, makeSessionValue, verifyAdminCredentials } from "@/lib/admin";
import { USER_COOKIE, USER_SESSION_TTL_MS, normalizeUsername, signUserSession, userConfigured, verifyPassword } from "@/lib/user-auth";
import { rateLimited, lockedOut, recordFailure, clearFailures } from "@/lib/rateLimit";
import { findUserByUsername, isSheetsConfigured, logAdminAction } from "@/lib/sheets";

/**
 * Unified sign-in: one form, two destinations.
 *  - Credentials matching the *configured* admin (ADMIN_USERNAME/ADMIN_PASSWORD) → admin session → /admin.
 *  - Otherwise, a registered user (scrypt hash check) → user session → /.
 */
export async function POST(req: NextRequest) {
  logAdminPasswordWeaknessOnce();
  if (!userConfigured() && !adminConfigured()) {
    return NextResponse.json({ ok: false, error: "Authentication is not configured on this deployment." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const scope = `unified:${ip}`;
  if (lockedOut(scope)) {
    return NextResponse.json({ ok: false, error: "Locked out after repeated failures — try again later." }, { status: 423 });
  }
  if (rateLimited(scope, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts — wait a minute." }, { status: 429 });
  }

  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }

  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  const isSecure = req.nextUrl.protocol === "https:";
  const cookieBase = { httpOnly: true, sameSite: "strict" as const, path: "/" };

  // 1) Admin path — env-configured credentials route to the admin console
  if (adminConfigured() && verifyAdminCredentials(username, password)) {
    clearFailures(scope);
    void logAdminAction("admin.login.success", `ip=${ip} · via unified sign-in`);
    const res = NextResponse.json({ ok: true, role: "admin", redirect: "/admin" });
    res.cookies.set(ADMIN_COOKIE, makeSessionValue(), { ...cookieBase, maxAge: 12 * 60 * 60, secure: isSecure });
    return res;
  }

  // 2) Registered-user path
  if (username && password && isSheetsConfigured()) {
    const user = await findUserByUsername(username);
    if (user && verifyPassword(password, user.salt, user.passwordHash)) {
      clearFailures(scope);
      const res = NextResponse.json({ ok: true, role: "user", redirect: "/", user: { userId: user.userId, username: user.username } });
      res.cookies.set(USER_COOKIE, signUserSession(user.userId, user.username), { ...cookieBase, maxAge: Math.floor(USER_SESSION_TTL_MS / 1000), secure: isSecure });
      return res;
    }
  }

  // 3) Failure — generic message, counted toward lockout, audited only for admin-targeted attempts
  const tripped = recordFailure(scope);
  const configuredAdmin = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  if (username && configuredAdmin && username === configuredAdmin) {
    void logAdminAction("admin.login.failure", `ip=${ip} · username=${username}`);
  }
  if (tripped) {
    void logAdminAction("auth.login.locked", `ip=${ip} · after 10 consecutive failures`);
    return NextResponse.json({ ok: false, error: "Locked out after repeated failures — try again later." }, { status: 423 });
  }
  return NextResponse.json({ ok: false, error: "Wrong username or password." }, { status: 401 });
}
