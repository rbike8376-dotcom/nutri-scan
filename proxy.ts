// Edge proxy — first-line guard for the admin console pages (Next 16: `middleware` renamed to `proxy`).
// Redirects to the unified /account sign-in; APIs remain independently guarded (/api/admin/* verifies the cookie).
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "nutriscan.admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verify(value: string | undefined): Promise<boolean> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password || username === "change-me-admin" || password === "change-me-password") return false;
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 4) return false;
  const [role, boundUser, tsRaw, sig] = parts;
  if (role !== "admin" || boundUser !== username) return false;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || Date.now() - ts > SESSION_TTL_MS || ts > Date.now() + 60_000) return false;

  const secret = process.env.ADMIN_SESSION_SECRET?.trim() || password;
  const payload = `admin:${username}:${tsRaw}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesEqual(new Uint8Array(signed), fromBase64Url(sig));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!(pathname === "/admin" || pathname.startsWith("/admin/"))) return NextResponse.next();
  const ok = await verify(req.cookies.get(ADMIN_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/account"; // unified sign-in lives here
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ["/admin/:path*"] };
