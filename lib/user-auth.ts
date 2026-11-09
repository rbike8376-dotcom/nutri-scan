// User accounts — scrypt password hashing + HMAC-signed httpOnly user sessions.
// Node runtime only. Passwords are never stored or logged anywhere.
import crypto from "crypto";

export const USER_COOKIE = "nutriscan.user";
export const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

/** Secret for signing user sessions. Separate override preferred; falls back to admin secrets (which exist in local dev). */
export function userConfigured(): boolean {
  return Boolean(userSessionSecret());
}

export function userSessionSecret(): string | null {
  const s =
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";
  return s || null;
}

/** Normalize a username for uniqueness checks (trim + lowercase). */
export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Returns an error message when the username is unusable, else null. */
export function usernameError(username: string): string | null {
  if (username.length < 3 || username.length > 32) return "Username must be 3–32 characters.";
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(username)) {
    return "Username can use letters, numbers, dot, dash, underscore — start and end with a letter or number.";
  }
  return null;
}

/** Returns an error message when the password is too weak, else null. */
export function passwordError(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long (max 128 characters).";
  if (!/[a-zA-Z]/.test(password)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

const RESERVED = new Set([
  "admin", "administrator", "root", "system", "support", "nutriscan", "help",
  "account", "auth", "api", "login", "logout", "signin", "signup", "register",
  "settings", "profile", "history", "scan", "verify", "result",
]);

/** Usernames nobody may self-register: app routes + the configured admin username. */
export function isReservedUsername(username: string): boolean {
  const u = normalizeUsername(username);
  if (RESERVED.has(u)) return true;
  const adminUser = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  return Boolean(adminUser && u === adminUser);
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------- Session cookies ----------

export type UserSession = { userId: string; username: string };

export function signUserSession(userId: string, username: string, now = Date.now()): string {
  const payload = `user:${userId}:${username}:${now}`;
  const sig = crypto.createHmac("sha256", userSessionSecret() ?? "").update(payload).digest("base64url");
  return `${payload}:${sig}`;
}

export function verifyUserSession(value: string | undefined | null, now = Date.now()): UserSession | null {
  const secret = userSessionSecret();
  if (!secret || !value) return null;
  const parts = value.split(":");
  if (parts.length !== 5) return null;
  const [role, userId, username, tsRaw, sig] = parts;
  if (role !== "user" || !userId || !username || /[:\s]/.test(userId) || /[:\s]/.test(username)) return null;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || now - ts > USER_SESSION_TTL_MS || ts > now + 60_000) return null;
  const expectedB64 = crypto.createHmac("sha256", secret).update(`user:${userId}:${username}:${tsRaw}`).digest("base64url");
  const a = Buffer.from(String(sig), "utf8");
  const b = Buffer.from(expectedB64, "utf8");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? { userId, username } : null;
}
