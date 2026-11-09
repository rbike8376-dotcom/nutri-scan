import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { USER_COOKIE, USER_SESSION_TTL_MS, normalizeUsername, passwordError, usernameError, isReservedUsername, hashPassword, signUserSession, userConfigured } from "@/lib/user-auth";
import { rateLimited } from "@/lib/rateLimit";
import { createUserAccount, isSheetsConfigured, upsertProfile } from "@/lib/sheets";

const RegisterSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  name: z.string().max(80).optional().default(""),
  email: z.string().email().max(200).optional().or(z.literal("")).default(""),
});

export async function POST(req: NextRequest) {
  if (!userConfigured()) {
    return NextResponse.json({ ok: false, error: "Sign-in is not configured on this deployment." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many sign-ups — wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check your details and try again." }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim();

  const uErr = usernameError(username);
  if (uErr) return NextResponse.json({ ok: false, error: uErr }, { status: 400 });
  if (isReservedUsername(username)) {
    return NextResponse.json({ ok: false, error: "That username is reserved — pick a different one." }, { status: 400 });
  }
  const pErr = passwordError(parsed.data.password);
  if (pErr) return NextResponse.json({ ok: false, error: pErr }, { status: 400 });

  if (!isSheetsConfigured()) {
    return NextResponse.json({ ok: false, error: "Accounts are unavailable right now — please try again later." }, { status: 503 });
  }

  const { hash, salt } = hashPassword(parsed.data.password);
  const created = await createUserAccount({ username, email, passwordHash: hash, salt });
  if (!created.ok) {
    const taken = created.error.includes("taken");
    return NextResponse.json({ ok: false, error: created.error }, { status: taken ? 409 : 503 });
  }

  // Persist the display name to the profile if provided (part of the account, editable later)
  if (name) {
    await upsertProfile({ userId: created.userId, name, goals: [], allergies: [], avoidList: [], prescriptionText: "" });
  }

  const isSecure = req.nextUrl.protocol === "https:";
  const res = NextResponse.json({ ok: true, role: "user", redirect: "/onboarding", user: { userId: created.userId, username } });
  res.cookies.set(USER_COOKIE, signUserSession(created.userId, username), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000),
    secure: isSecure,
  });
  return res;
}
