"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp, getOrCreateUserId } from "@/components/AppProvider";
import { useLanguage } from "@/components/LanguageProvider";
import SpeakListButton from "@/components/SpeakListButton";
import LocalTime from "@/components/LocalTime";

type StoredScan = {
  id: string;
  productName: string;
  barcode: string;
  source: string;
  rating: string;
  allergyRisks: string[];
  reasons: string[];
  createdAt: string;
};

const TAG: Record<string, string> = {
  good: "bg-[var(--surface-2)] text-[var(--gold-strong)]",
  caution: "bg-amber-100 text-[var(--amber-deep)]",
  avoid: "bg-red-100 text-red-800",
};
const LABEL: Record<string, string> = { good: "Good Fit", caution: "Use Caution", avoid: "Not a Fit" };

export default function HistoryPage() {
  const { profile } = useApp();
  const { t } = useLanguage();
  const [history, setHistory] = useState<StoredScan[] | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const userId = profile.userId || (typeof window !== "undefined" ? getOrCreateUserId() : "");

  const load = () => {
    if (!userId) { setHistory([]); return; }
    fetch(`/api/history?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => { setError("Could not load history — Google Sheets may be unreachable."); setHistory([]); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [userId]);

  const remove = async (id: string) => {
    await fetch(`/api/history?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setHistory((h) => (h ?? []).filter((x) => x.id !== id));
  };

  const clearAll = async () => {
    if (!confirm("Delete your entire scan history from Google Sheets? This cannot be undone.")) return;
    await fetch(`/api/history?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setHistory([]);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">← Home</Link>
        {history && history.length > 0 && (
          <button onClick={clearAll} className="min-h-11 rounded-xl border border-red-300 px-4 text-sm font-bold text-red-800">{t("history.clearAll")}</button>
        )}
      </header>

      <h1 className="mt-2 text-3xl font-black text-[var(--text)]">{t("history.title")}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Verdicts saved from the Google Sheets database. Photos are never stored — only product names and results.</p>

      {error && <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[var(--amber-deep)]" role="alert">{error}</p>}

      {history === null ? (
        <p className="mt-8 text-center text-[var(--muted)]">Loading…</p>
      ) : history.length === 0 ? (
        <div className="mt-8 panel p-8 text-center">
          <div className="text-5xl" aria-hidden>📭</div>
          <p className="mt-3 font-extrabold text-[var(--text)]">No saved scans yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Tick “Save this verdict to my history” on the verification screen, then it will show up here.</p>
          <Link href="/" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--mocha)] px-6 font-bold text-white">Scan something →</Link>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {history.map((h) => (
            <li key={h.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${TAG[h.rating] ?? "bg-[var(--surface-2)] text-[var(--gold-strong)]"}`}>{LABEL[h.rating] ?? h.rating}</span>
                    <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--gold-strong)]">{h.source === "barcode" ? "Barcode" : "Photo"}</span>
                    {h.barcode && <span className="font-mono text-[10px] text-[var(--muted)]">{h.barcode}</span>}
                  </div>
                  <strong className="mt-1 block truncate text-[var(--text)]">{h.productName || "Unnamed product"}</strong>
                  <small className="text-[var(--muted)]">{h.createdAt ? <LocalTime iso={h.createdAt} /> : ""}</small>
                  {h.allergyRisks.length > 0 && (
                    <p className="mt-1 text-[11px] text-red-800">Risks: {h.allergyRisks.join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button onClick={() => setExpanded(expanded === h.id ? null : h.id)} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-bold text-[var(--text)]">{t("history.why")}</button>
                  <button onClick={() => void remove(h.id)} aria-label="Delete this entry" className="min-h-11 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-800">Delete</button>
                </div>
              </div>
              {expanded === h.id && h.reasons.length > 0 && (
                <div className="mt-2 border-t border-[var(--border)] pt-2">
                  <div className="flex items-center justify-between gap-2 pl-0"><span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold-strong)]">Why</span><SpeakListButton items={h.reasons} /></div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text)]/80">
                    {h.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
