import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ADMIN_COOKIE, verifySessionValue } from "@/lib/admin";
import AdminDashboard from "./AdminDashboard";

// Next 16 cacheComponents: allow a blocking, request-time route for the admin guard.
export const instant = false;

// Server-side guard: page unreachable without a valid signed admin cookie.
export default async function AdminPage() {
  await connection();
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    redirect("/account");
  }
  return <AdminDashboard />;
}
