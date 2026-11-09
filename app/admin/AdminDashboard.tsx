"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminUser = { userId: string; email: string; createdAt: string; consentHistory: boolean };
type AdminProfile = { userId: string; name: string; goals: string[]; allergies: string[]; avoidList: string[]; prescriptionText: string; updatedAt: string };
type AdminScan = { id: string; userId: string; productName: string; barcode: string; source: string; rating: string; allergyRisks: string[]; reasons: string[]; createdAt: string };
type AdminAudit = { ts: string; action: string; detail: string };
type SettingsData = {
  sheetLinkVisible: boolean;
  copy: { heroBadge: string; heroTitle: string; heroSubtitle: string };
  features: { voice: boolean; ask: boolean; history: boolean };
};
type AdminData = {
  adminEnabled: boolean;
  sheetsAvailable: boolean;
  sheetUrl: string | null;
  stats: {
    totalUsers: number; totalProfiles: number; totalScans: number; usersWithConsent: number;
    ratings: Record<string, number>;
    topAllergens: { name: string; count: number }[];
  };
  users: AdminUser[]; profiles: AdminProfile[]; scans: AdminScan[]; audit: AdminAudit[];
};

const ratingChip = (rating: string) =>
  rating === "good" ? "bg-[#e7c878]/15 text-[#e7c878]" : rating === "caution" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300";

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"overview" | "users" | "scans" | "audit" | "settings">("overview");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNote, setSettingsNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/data")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/settings").then(async (r) => { if (r.ok) setSettings(await r.json()); }).catch(() => { /* keep null */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true); setSettingsNote("");
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      setSettings(body.settings);
      setSettingsNote("Saved ✓ — changes apply to the consumer app immediately.");
      load();
    } catch (e) {
      setSettingsNote(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  const updateSettings = (patch: Partial<SettingsData>) => setSettings((s) => (s ? { ...s, ...patch } : s));
  const updateCopy = (key: keyof SettingsData["copy"], value: string) => setSettings((s) => (s ? { ...s, copy: { ...s.copy, [key]: value } } : s));
  const updateFeature = (key: keyof SettingsData["features"], value: boolean) => setSettings((s) => (s ? { ...s, features: { ...s.features, [key]: value } } : s));

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Action failed");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/account");
  };

  const exportJson = () => {
    if (!data) return;
    const safe = { ...data, sheetUrl: null }; // raw sheet link is not included in exports
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nutriscan-admin-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="admin-shell">
      {/* Admin topbar */}
      <header className="sticky top-0 z-20 border-b border-[#e7c878]/10 bg-[#160d0a]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 font-black text-[#e7c878]">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7c878]/10">🛡️</span>
            NutriScan <span className="text-[#f7e9d5]">Admin</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-3 py-1 font-bold ${data?.sheetsAvailable ? "bg-[#e7c878]/15 text-[#e7c878]" : "bg-amber-500/15 text-amber-300"}`}>{data?.sheetsAvailable ? "● Sheets live" : "● Sheets offline"}</span>
            {data?.sheetUrl && settings?.sheetLinkVisible !== false && (
              <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer" className="min-h-11 flex items-center rounded-lg border border-[#e7c878]/25 px-3 font-bold text-[#e7c878] hover:bg-[#e7c878]/10" title="Admin-only link to the Google Sheet database">Open Sheet ↗</a>
            )}
            <button onClick={exportJson} disabled={!data} className="min-h-11 rounded-lg border border-[#e7c878]/25 px-3 font-bold text-[#f4e6d2] hover:bg-[#e7c878]/10 disabled:opacity-40">Export JSON</button>
            <Link href="/" className="min-h-11 flex items-center rounded-lg border border-[#e7c878]/15 px-3 text-[#f4e6d2]/80 hover:bg-[#e7c878]/10">App →</Link>
            <button onClick={logout} className="min-h-11 rounded-lg border border-red-400/30 px-3 font-bold text-red-300 hover:bg-red-500/10">Sign out</button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm font-bold">
          {(["overview", "users", "scans", "audit", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`min-h-11 whitespace-nowrap rounded-lg px-4 capitalize transition ${tab === t ? "bg-[#e7c878] text-[#2a1608]" : "text-[#f4e6d2]/70 hover:bg-[#e7c878]/10"}`}>{t}</button>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-20">
        {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300" role="alert">{error}</p>}
        {!data ? (
          <p className="mt-10 text-center text-[#cfb39e]">Loading admin data…</p>
        ) : (
          <>
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Users", value: data.stats.totalUsers, icon: "👤" },
                    { label: "Profiles", value: data.stats.totalProfiles, icon: "📋" },
                    { label: "Scans logged", value: data.stats.totalScans, icon: "🔍" },
                    { label: "Consent given", value: data.stats.usersWithConsent, icon: "✅" },
                  ].map((c) => (
                    <div key={c.label} className="admin-card p-4">
                      <div className="text-2xl" aria-hidden>{c.icon}</div>
                      <div className="mt-1 text-3xl font-black text-[#f7e9d5]">{c.value}</div>
                      <div className="text-xs font-bold uppercase tracking-wide text-[#cfb39e]/70">{c.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="admin-card p-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-[#e7c878]">Verdict distribution</h2>
                    <div className="mt-3 flex flex-col gap-2">
                      {Object.entries(data.stats.ratings).map(([rating, count]) => {
                        const max = Math.max(1, ...Object.values(data.stats.ratings));
                        return (
                          <div key={rating} className="flex items-center gap-2 text-sm">
                            <span className={`w-20 rounded-md px-2 py-0.5 text-center text-[10px] font-black uppercase ${ratingChip(rating)}`}>{rating}</span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#130c09]">
                              <div className={`h-full rounded-full ${rating === "good" ? "bg-[#e7c878]" : rating === "caution" ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                            <span className="w-8 text-right font-mono text-[#f4e6d2]/80">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="admin-card p-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-[#e7c878]">Top flagged allergens</h2>
                    {data.stats.topAllergens.length === 0 ? (
                      <p className="mt-3 text-sm text-[#cfb39e]/60">No allergy flags logged yet.</p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-2">
                        {data.stats.topAllergens.map((a) => (
                          <li key={a.name} className="flex items-center justify-between rounded-xl border border-red-400/15 bg-red-500/5 px-3 py-2 text-sm">
                            <span className="font-bold text-red-300">⚠ {a.name}</span>
                            <span className="font-mono text-[#f4e6d2]/70">{a.count}×</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="admin-card mt-4 p-5 text-xs text-[#cfb39e]">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#e7c878]">Sheet access — admin only</h2>
                  <p className="mt-2">The database sheet link is shown only to this authenticated admin session and is never exposed to normal users or included in exports.</p>
                  {data.sheetUrl && settings?.sheetLinkVisible !== false ? (
                    <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 font-bold text-[#e7c878] underline underline-offset-4">Open the live sheet ↗</a>
                  ) : data.sheetUrl ? (
                    <p className="mt-2 text-[#cfb39e]">Sheet link hidden by your Settings toggle — re-enable it in the Settings tab.</p>
                  ) : (
                    <p className="mt-2 text-amber-300/80">Sheets not configured — set GOOGLE_SERVICE_ACCOUNT_JSON and SHEET_ID to enable sync.</p>
                  )}
                  <p className="mt-2">For Drive-level enforcement, keep the sheet’s sharing set to “Restricted — only people added can open” with only the admin account added. The service account needs edit access regardless of Viewer restrictions.</p>
                </div>

                <p className="mt-4 text-[11px] text-[#cfb39e]/50">Admin sees only what the Sheets database stores — structured rows, never photos. Destructive actions are written to the <code>AdminAudit</code> tab. Prescription texts are sensitive: share only with consent.</p>
              </>
            )}

            {tab === "users" && (
              <div className="admin-card overflow-x-auto p-4">
                <table className="admin-table w-full min-w-[760px]">
                  <thead><tr><th>User</th><th>Goals</th><th>Allergies</th><th>Consent</th><th>Since</th><th></th></tr></thead>
                  <tbody>
                    {data.users.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#cfb39e]/50">No users yet.</td></tr>}
                    {data.users.map((u) => {
                      const p = data.profiles.find((pp) => pp.userId === u.userId);
                      return (
                        <tr key={u.userId}>
                          <td className="font-mono text-[11px] text-[#f4e6d2]/80">{u.userId.slice(0, 10)}…{u.email ? ` · ${u.email}` : ""}</td>
                          <td>{p?.goals.join(", ") || "—"}</td>
                          <td>{p?.allergies.join(", ") || "—"}</td>
                          <td>
                            <button disabled={busy} onClick={() => void act({ action: "toggleConsent", userId: u.userId, consent: !u.consentHistory })} className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${u.consentHistory ? "bg-[#e7c878]/20 text-emerald-300" : "bg-slate-600/30 text-slate-300"}`}>
                              {u.consentHistory ? "granted" : "off"}
                            </button>
                          </td>
                          <td className="text-[#cfb39e]/60">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                          <td>
                            <button disabled={busy} onClick={() => { if (confirm(`Delete ALL data for user ${u.userId.slice(0, 8)}… ? This removes profile, user row and all scan history.`)) void act({ action: "deleteAllUserData", userId: u.userId }); }} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-[11px] font-black text-red-300 hover:bg-red-500/10">DELETE</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "scans" && (
              <div className="admin-card overflow-x-auto p-4">
                <table className="admin-table w-full min-w-[820px]">
                  <thead><tr><th>When</th><th>Product</th><th>Source</th><th>Verdict</th><th>Allergy flags</th><th></th></tr></thead>
                  <tbody>
                    {data.scans.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#cfb39e]/50">No scans logged yet.</td></tr>}
                    {data.scans.map((s) => (
                      <tr key={s.id}>
                        <td className="text-[#cfb39e]/60">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                        <td className="max-w-56 truncate font-semibold text-[#f4e6d2]/90" title={s.productName}>{s.productName || "—"}</td>
                        <td className="uppercase text-[10px] text-[#cfb39e]/60">{s.source}</td>
                        <td><span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${ratingChip(s.rating)}`}>{s.rating}</span></td>
                        <td className="text-red-300/90">{s.allergyRisks.join(", ") || "—"}</td>
                        <td>
                          <button disabled={busy} onClick={() => { if (confirm("Delete this scan row?")) void act({ action: "deleteScan", userId: s.userId, scanId: s.id }); }} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-[11px] font-black text-red-300 hover:bg-red-500/10">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "audit" && (
              <div className="admin-card overflow-x-auto p-4">
                <table className="admin-table w-full min-w-[620px]">
                  <thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
                  <tbody>
                    {data.audit.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-[#cfb39e]/50">No admin actions logged yet.</td></tr>}
                    {data.audit.map((a, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap text-[#cfb39e]/60">{a.ts ? new Date(a.ts).toLocaleString() : "—"}</td>
                        <td className="font-bold text-[#e7c878]">{a.action}</td>
                        <td className="text-[#f4e6d2]/75">{a.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "settings" && settings && (
              <div className="flex max-w-3xl flex-col gap-4">
                <div className="admin-card p-5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#e7c878]">Consumer copy (hero)</h2>
                  <p className="mt-1 text-xs text-[#cfb39e]">Leave blank to use the built-in translations (EN/HI/ES). Safety disclaimers can never be removed here.</p>
                  <label className="mt-2 flex flex-col gap-1 text-[11px] font-bold uppercase text-[#cfb39e]">Badge<input className="admin-input" value={settings.copy.heroBadge} onChange={(e) => updateCopy("heroBadge", e.target.value)} placeholder="Informational only — not medical advice" /></label>
                  <label className="mt-2 flex flex-col gap-1 text-[11px] font-bold uppercase text-[#cfb39e]">Headline (use line breaks)<textarea className="admin-input min-h-20 normal-case" value={settings.copy.heroTitle} onChange={(e) => updateCopy("heroTitle", e.target.value)} placeholder={"Know what's\nreally\nin your food."} /></label>
                  <label className="mt-2 flex flex-col gap-1 text-[11px] font-bold uppercase text-[#cfb39e]">Subtitle<textarea className="admin-input min-h-16 normal-case" value={settings.copy.heroSubtitle} onChange={(e) => updateCopy("heroSubtitle", e.target.value)} placeholder="Scan a barcode or snap the label…" /></label>
                </div>

                <div className="admin-card p-5">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#e7c878]">Features & sheet access</h2>
                  {([
                    { key: "voice", label: "Voice (mic STT + read-aloud)" },
                    { key: "ask", label: "Ask the AI box" },
                    { key: "history", label: "History navigation & saving" },
                  ] as const).map((f) => (
                    <label key={f.key} className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#e7c878]/15 bg-black/20 p-3 text-sm">
                      <span className="text-[#f7e9d5]">{f.label}</span>
                      <input type="checkbox" className="h-5 w-5 accent-[#e7c878]" checked={settings.features[f.key]} onChange={(e) => updateFeature(f.key, e.target.checked)} />
                    </label>
                  ))}
                  <label className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#e7c878]/15 bg-black/20 p-3 text-sm">
                    <span className="text-[#f7e9d5]"><strong className="block">Show “Open Sheet” link (admin only)</strong>Hide it from this console; link is still never sent to normal users</span>
                    <input type="checkbox" className="h-5 w-5 accent-[#e7c878]" checked={settings.sheetLinkVisible} onChange={(e) => updateSettings({ sheetLinkVisible: e.target.checked })} />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => void saveSettings()} disabled={savingSettings} className="min-h-12 rounded-xl bg-gradient-to-r from-[#b9862f] via-[#e7c878] to-[#c2410c] px-6 font-black text-[#2a1608] hover:brightness-110 disabled:opacity-50">{savingSettings ? "Saving…" : "Save all settings"}</button>
                  <p className="text-xs text-[#cfb39e]">{settingsNote || "Stored in the AdminSettings sheet tab · every save is written to AdminAudit."}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
