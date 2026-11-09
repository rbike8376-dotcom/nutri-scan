import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-auth";
import { getProfile, getUserById, isSheetsConfigured } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  const session = verifyUserSession(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ user: null });
  if (!isSheetsConfigured()) {
    return NextResponse.json({ user: { ...session, name: "", email: "" } });
  }
  const [account, profile] = await Promise.all([getUserById(session.userId), getProfile(session.userId)]);
  return NextResponse.json({
    user: {
      userId: session.userId,
      username: session.username,
      name: profile?.name ?? "",
      email: account?.email ?? "",
    },
  });
}
