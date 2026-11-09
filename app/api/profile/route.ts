import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser, getProfile, getUserConsent, upsertProfile, setUserConsent, deleteAllUserData } from "@/lib/sheets";
import { resolveUserId } from "@/lib/auth-context";

export async function DELETE(req: NextRequest) {
  const { userId } = await resolveUserId(req.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const deleted = await deleteAllUserData(userId);
  return NextResponse.json({ deleted });
}

export async function GET(req: NextRequest) {
  const { userId } = await resolveUserId(req.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const [profile, consentHistory] = await Promise.all([getProfile(userId), getUserConsent(userId)]);
  if (!profile) return NextResponse.json({ profile: null, consentHistory });
  return NextResponse.json({ profile: { ...profile, consentHistory } });
}

const PostSchema = z.object({
  userId: z.string().max(80).optional().default(""),
  name: z.string().max(120).optional().default(""),
  email: z.string().email().max(200).optional().or(z.literal("")).default(""),
  goals: z.array(z.string().max(60)).max(20).default([]),
  allergies: z.array(z.string().max(80)).max(30).default([]),
  avoidList: z.array(z.string().max(80)).max(50).default([]),
  prescriptionText: z.string().max(4000).optional().default(""),
  consentHistory: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile" }, { status: 400 });
  }

  // Signed-in sessions are authoritative — a client may not write into another user's profile.
  const { userId } = await resolveUserId(parsed.data.userId);
  if (!userId) return NextResponse.json({ error: "Sign in or provide a userId." }, { status: 400 });
  const { name, email, goals, allergies, avoidList, prescriptionText, consentHistory } = parsed.data;

  // Users row first (ensures consent has a home), then profile, then consent flag
  await ensureUser(userId, email);
  const [profileResult, consentSaved] = await Promise.all([
    upsertProfile({ userId, name, goals, allergies, avoidList, prescriptionText }),
    setUserConsent(userId, consentHistory, email),
  ]);

  return NextResponse.json({
    profile: { userId, name, goals, allergies, avoidList, prescriptionText, consentHistory },
    stored: profileResult.stored && consentSaved,
    sheetsAvailable: profileResult.stored,
  });
}
