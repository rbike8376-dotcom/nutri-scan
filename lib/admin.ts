// Admin session — node runtime only (HMAC-signed, httpOnly cookie).
// Disabled until ADMIN_USERNAME and ADMIN_PASSWORD are set in the environment.
import crypto from "crypto";

export const ADMIN_COOKIE = "nutriscan.admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const PLACEHOLDER_USER = "change-me-admin";
const PLACEHOLDER_PASSWORD = "change-me-password";

export function adminConfigured(): boolean {
  const u = process.env.ADMIN_USERNAME?.trim();
  const p = process.env.ADMIN_PASSWORD?.trim();
  return Boolean(u && p && u !== PLACEHOLDER_USER && p !== PLACEHOLDER_PASSWORD);
}

const WEAK_PASSWORDS = new Set(["sujal@123", "admin", "password", "nutriscan-admin-2026", "change-me-nutriscan-admin"]);
let weakWarned = false;

/** Human-readable warning if the configured admin password stays weak. Logged once per process. */
export function adminPasswordWeakness(): string | null {
  const p = process.env.ADMIN_PASSWORD?.trim();
  if (!p) return null;
  const weak = p.length < 12 || WEAK_PASSWORDS.has(p.toLowerCase());
  if (!weak) return null;
  return "ADMIN_PASSWORD is weak — rotate it before deploying publicly (use a 16+ char random phrase).";
}

export function logAdminPasswordWeaknessOnce(): void {
  if (weakWarned) return;
  weakWarned = true;
  const warning = adminPasswordWeakness();
  if (warning) console.warn(`[admin] ${warning}`);
}

function adminUsername(): string | null {
  const u = process.env.ADMIN_USERNAME?.trim();
  return adminConfigured() && u ? u : null;
}

function secret(): string | null {
  if (!adminConfigured()) return null;
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD!.trim();
}

const digest = (value: string) => crypto.createHash("sha256").update(value, "utf8").digest();

function safeEqual(a: string, b: string): boolean {
  const ah = digest(a);
  const bh = digest(b);
  return crypto.timingSafeEqual(ah, bh);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const u = adminUsername();
  const p = process.env.ADMIN_PASSWORD?.trim();
  if (!u || !p || typeof username !== "string" || typeof password !== "string") return false;
  return safeEqual(username, u) && safeEqual(password, p);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret() ?? "").update(payload).digest("base64url");
}

export function makeSessionValue(now = Date.now()): string {
  const username = adminUsername();
  if (!username) throw new Error("Admin is not configured");
  const payload = `admin:${username}:${now}`;
  return `${payload}:${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined | null, now = Date.now()): boolean {
  if (!value) return false;
  const username = adminUsername();
  if (!username) return false;
  const parts = value.split(":");
  if (parts.length !== 4) return false;
  const [role, boundUser, tsRaw, sig] = parts;
  if (role !== "admin" || boundUser !== username) return false;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || now - ts > SESSION_TTL_MS || ts > now + 60_000) return false;
  const expected = sign(`admin:${username}:${tsRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isReadOnlyDemo(): boolean {
  return !adminConfigured();
}
