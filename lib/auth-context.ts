// Resolve the acting userId for a request. Server-side only.
// A signed-in user's session is authoritative (client params are ignored);
// guests fall back to the client-supplied ephemeral id; admins may target a userId for support.
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-auth";

export type ActingIdentity = { userId: string | null; signedIn: boolean; admin: boolean };

export async function resolveUserId(clientUserId?: string | null): Promise<ActingIdentity> {
  const store = await cookies();
  const session = verifyUserSession(store.get(USER_COOKIE)?.value);
  if (session) return { userId: session.userId, signedIn: true, admin: false };

  const clean = clientUserId?.trim() || null;
  const admin = verifySessionValue(store.get(ADMIN_COOKIE)?.value);
  if (admin) return { userId: clean, signedIn: false, admin: true };

  return { userId: clean, signedIn: false, admin: false };
}
