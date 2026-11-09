import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifySessionValue } from "@/lib/admin";
import { listUsers, listProfiles, listScansAll, listAudit, isSheetsConfigured } from "@/lib/sheets";

export async function GET() {
  const store = await cookies();
  if (!verifySessionValue(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  const sheetsAvailable = isSheetsConfigured();
  const sheetId = process.env.SHEET_ID?.trim() ?? "";
  const [users, profiles, scans, audit] = await Promise.all([listUsers(300), listProfiles(300), listScansAll(200), listAudit(100)]);

  const ratings = { good: 0, caution: 0, avoid: 0 } as Record<string, number>;
  const allergyFrequency = new Map<string, number>();
  for (const s of scans) {
    if (ratings[s.rating] !== undefined) ratings[s.rating] += 1;
    for (const r of s.allergyRisks) {
      const key = r.replace(/\((high|medium|low)\)\s*$/i, "").trim().toLowerCase();
      if (key) allergyFrequency.set(key, (allergyFrequency.get(key) ?? 0) + 1);
    }
  }
  const topAllergens = [...allergyFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    adminEnabled: adminConfigured(),
    sheetsAvailable,
    // Admin-only: link to the live database sheet. Never exposed outside a verified admin session.
    sheetUrl: sheetsAvailable && sheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit` : null,
    stats: {
      totalUsers: users.length,
      totalProfiles: profiles.length,
      totalScans: scans.length,
      ratings,
      topAllergens,
      usersWithConsent: users.filter((u) => u.consentHistory).length,
    },
    users,
    profiles,
    scans,
    audit,
  });
}
