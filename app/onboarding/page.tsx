"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useApp, getOrCreateUserId, type ProfileState } from "@/components/AppProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { ALL_DISCLAIMERS } from "@/lib/disclaimers";
import VoiceButton from "@/components/VoiceButton";

const GOALS = [
  { id: "gym-fitness", label: "Gym / fitness" },
  { id: "weight-loss", label: "Weight loss" },
  { id: "height-growth", label: "Height growth" },
  { id: "low-sugar", label: "Low sugar" },
  { id: "low-added-sugar", label: "Low added sugar" },
  { id: "low-sodium", label: "Low sodium" },
  { id: "high-protein", label: "High protein" },
  { id: "high-fiber", label: "High fiber" },
  { id: "low-sat-fat", label: "Low saturated fat" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
];

const ALLERGENS = [
  { id: "peanut", label: "Peanut" }, { id: "tree_nut", label: "Tree nuts" }, { id: "milk", label: "Milk / lactose" },
  { id: "egg", label: "Egg" }, { id: "soy", label: "Soy" }, { id: "gluten", label: "Gluten" },
  { id: "fish", label: "Fish" }, { id: "shellfish", label: "Shellfish" }, { id: "sesame", label: "Sesame" },
  { id: "mustard", label: "Mustard" }, { id: "celery", label: "Celery" }, { id: "sulphites", label: "Sulphites" },
  { id: "lupin", label: "Lupin" },
];

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export default function OnboardingPage() {
  const { profile, setProfile, profileLoaded, authUser, signOut } = useApp();
  const [form, setForm] = useState<ProfileState>(profile);
  const [customAllergy, setCustomAllergy] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [sheetWarning, setSheetWarning] = useState("");
  const [email, setEmail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const reportInputRef = useRef<HTMLInputElement>(null);
  const { ocrLang } = useLanguage();

  // Prefill email from the signed-in account (it is not editable here — it belongs to the account)
  useEffect(() => {
    if (authUser?.email) setEmail(authUser.email);
  }, [authUser?.email]);

  // Hydrate from server (Sheets) once we know the userId; fall back to cache
  useEffect(() => {
    if (!profileLoaded) return;
    const userId = getOrCreateUserId();
    if (!userId) {
      setForm((f) => ({ ...f, userId }));
      return;
    }
    fetch(`/api/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile) {
          const p: ProfileState = {
            userId,
            name: data.profile.name ?? "",
            goals: data.profile.goals ?? [],
            allergies: data.profile.allergies ?? [],
            avoidList: data.profile.avoidList ?? [],
            prescriptionText: data.profile.prescriptionText ?? "",
            consentHistory: Boolean(data.profile.consentHistory ?? data.consentHistory),
          };
          setForm(p);
          setProfile(p);
        } else {
          setForm((f) => ({ ...f, userId }));
        }
      })
      .catch(() => setForm((f) => ({ ...f, userId })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  const customAllergies = useMemo(
    () => form.allergies.filter((a) => !ALLERGENS.some((x) => x.id === a)),
    [form.allergies]
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(""); setSheetWarning("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId || getOrCreateUserId(),
          name: form.name,
          email,
          goals: form.goals,
          allergies: form.allergies,
          avoidList: form.avoidList,
          prescriptionText: form.prescriptionText,
          consentHistory: form.consentHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setProfile({ ...form, userId: data.profile?.userId ?? form.userId });
      setSavedAt(new Date());
      if (!data?.sheetsAvailable) {
        setSheetWarning("Saved on this device only — Google Sheets is not reachable, so history sync is disabled until it is.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile. Is the sheet configured?");
    } finally {
      setSaving(false);
    }
  };

  const chipClass = (active: boolean) =>
    `chip ${active ? "chip-active" : ""}`;

  const readReportFile = async (file: File) => {
    setReportBusy(true); setReportNote(""); setError("");
    try {
      const isText = file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);
      if (isText) {
        const text = await file.text();
        setForm((f) => ({ ...f, prescriptionText: (f.prescriptionText ? f.prescriptionText + "\n" : "") + text.trim() }));
        setReportNote("Text report loaded into the box below — check it, then Save.");
        return;
      }
      if (file.type.startsWith("image/")) {
        const Tesseract = await import("tesseract.js");
        const { data } = await Tesseract.default.recognize(file, ocrLang);
        const extracted = (data.text ?? "").trim();
        if (!extracted) throw new Error("No readable text found — try a flatter, better-lit photo.");
        setForm((f) => ({ ...f, prescriptionText: (f.prescriptionText ? f.prescriptionText + "\n" : "") + extracted }));
        setReportNote("Report read on-device — check the text below, then Save.");
        return;
      }
      setReportNote("PDF isn't supported yet — upload a photo/TXT of the report, or paste the text directly.");
    } catch (err) {
      setReportNote(err instanceof Error ? err.message : "Couldn't read that report — try a clearer photo or paste the text.");
    } finally {
      setReportBusy(false);
      if (reportInputRef.current) reportInputRef.current.value = "";
    }
  };

  const exportSummary = () => {
    const payload = {
      name: form.name || "NutriScan user",
      goals: form.goals,
      allergies: form.allergies,
      avoidList: form.avoidList,
      doctorNotes: form.prescriptionText,
      note: "Self-reported profile summary generated by NutriScan AI. Informational only — not medical advice.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "nutriscan-profile-summary.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">← Home</Link>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Step 1 of 1</span>
      </header>

      <h1 className="mt-2 text-4xl font-black tracking-tight text-[var(--text)]">Your <span className="headline-gradient">profile</span></h1>
      <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">This is everything the AI is allowed to know about you. Keep it honest — it decides what you see after every scan.</p>

      {/* Account strip — session is resolved client-side; keeps layout height stable while loading */}
      {authUser ? (
        <div className="rise mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-2.5 text-xs shadow-sm">
          <span className="font-extrabold text-[var(--text)]">Signed in as <span className="text-[var(--gold-strong)]">@{authUser.username}</span> — this profile lives on your account and edits anywhere.</span>
          <button type="button" onClick={() => void signOut()} className="min-h-11 shrink-0 px-2 font-black text-[var(--gold-strong)] hover:underline">Sign out</button>
        </div>
      ) : (
        <div className="rise mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)] px-4 py-2.5 text-xs text-[var(--muted)]">
          <span><strong className="text-[var(--text)]">Guest mode</strong> — scans work, but this profile stays only on this device.</span>
          <Link href="/account" className="min-h-11 inline-flex shrink-0 items-center px-2 font-black text-[var(--gold-strong)] hover:underline">Sign in to keep it →</Link>
        </div>
      )}

      <form onSubmit={save} className="panel mt-5 flex flex-col gap-6 p-4 sm:p-6">
        {/* Basics */}
        <fieldset>
          <legend className="kicker !text-[0.7rem]">About you</legend>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Name (optional)
              <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="given-name" placeholder="Alex" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {authUser ? "Email (from your account)" : "Email (optional — links your history across devices)"}
              <input type="email" className="input disabled:opacity-60" value={authUser ? authUser.email ?? "" : email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" placeholder="you@example.com" {...(authUser ? { readOnly: true, disabled: true } : {})} />
            </label>
          </div>
        </fieldset>

        {/* Goals */}
        <fieldset>
          <legend className="kicker !text-[0.7rem]">Dietary goals</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <label key={g.id} className={chipClass(form.goals.includes(g.id))}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--gold-strong)]" checked={form.goals.includes(g.id)} onChange={() => setForm({ ...form, goals: toggle(form.goals, g.id) })} />
                {g.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Allergies */}
        <fieldset>
          <legend className="kicker !text-[0.7rem]">Declared allergies / intolerances</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <label key={a.id} className={chipClass(form.allergies.includes(a.id))}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--gold-strong)]" checked={form.allergies.includes(a.id)} onChange={() => setForm({ ...form, allergies: toggle(form.allergies, a.id) })} />
                {a.label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              className="input flex-1 min-h-11 text-sm"
              placeholder="Add other (e.g. kiwifruit)…"
              value={customAllergy}
              onChange={(e) => setCustomAllergy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = customAllergy.trim().toLowerCase();
                  if (v && !form.allergies.includes(v)) setForm({ ...form, allergies: [...form.allergies, v] });
                  setCustomAllergy("");
                }
              }}
            />
            <button type="button" className="btn btn-secondary !min-h-11 text-xs" onClick={() => {
              const v = customAllergy.trim().toLowerCase();
              if (v && !form.allergies.includes(v)) setForm({ ...form, allergies: [...form.allergies, v] });
              setCustomAllergy("");
            }}>Add</button>
          </div>
          {customAllergies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {customAllergies.map((a) => (
                <span key={a} className="inline-flex items-center gap-2 rounded-full bg-[var(--mocha)] text-white px-3 py-1.5 text-sm font-semibold">
                  {a}
                  <button type="button" aria-label={`Remove ${a}`} onClick={() => setForm({ ...form, allergies: form.allergies.filter((x) => x !== a) })} className="text-white/90">×</button>
                </span>
              ))}
            </div>
          )}
        </fieldset>

        {/* Avoid list */}
        <fieldset>
          <legend className="kicker !text-[0.7rem]">Avoid list <span className="normal-case font-medium text-[var(--muted)]">(comma-separated)</span></legend>
          <input
            type="text" className="input mt-2 text-sm"
            placeholder="palm oil, aspartame, E951, pork gelatine…"
            value={form.avoidList.join(", ")}
            onChange={(e) => setForm({ ...form, avoidList: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </fieldset>

        {/* Prescription (optional, free text for now) */}
        <fieldset>
          <legend className="kicker !text-[0.7rem]">Doctor&apos;s report <span className="normal-case font-medium text-[var(--muted)]">(optional)</span></legend>
          <p className="hint mt-1">Paste or dictate anything relevant your doctor told you to watch (e.g. &quot;reduce sodium — kidney diet&quot;). Used as AI context only. Never shown to anyone else.</p>
          <div className="mt-1 flex items-start gap-2">
            <textarea className="input min-h-24 p-3 text-sm normal-case" placeholder="e.g. Doctor advised a low-sodium, low-saturated-fat diet…" value={form.prescriptionText} onChange={(e) => setForm({ ...form, prescriptionText: e.target.value })} />
            <VoiceButton onText={(txt) => setForm((f) => ({ ...f, prescriptionText: (f.prescriptionText ? f.prescriptionText + " " : "") + txt }))} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={reportBusy} onClick={() => reportInputRef.current?.click()} className="btn btn-secondary !min-h-11 text-xs">{reportBusy ? "Reading report…" : "📎 Upload report (photo/TXT)"}</button>
            <button type="button" onClick={exportSummary} className="btn btn-secondary !min-h-11 text-xs">⬇ Export my summary</button>
            <input ref={reportInputRef} type="file" accept="image/*,text/*,.txt,.md,.csv,.pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readReportFile(f); }} aria-label="Upload a photo or text file of your medical report" />
          </div>
          <p className="hint mt-1">Read on-device only — the report file itself is never uploaded. “Send” means you export/share this summary yourself, e.g. with your doctor.</p>
          {reportNote && <p className="hint mt-1 font-bold text-[var(--gold-strong)]" role="status">{reportNote}</p>}
        </fieldset>

        {/* Consent */}
        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--gold-strong)]" checked={form.consentHistory} onChange={(e) => setForm({ ...form, consentHistory: e.target.checked })} />
          <span className="text-sm">
            <strong className="block">Save my scan history</strong>
            Store product names and AI verdicts (never photos) against my profile so I can review them later. You can delete it any time from the History page.
          </span>
        </label>

        {error && <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        {sheetWarning && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[var(--amber-deep)]">{sheetWarning}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-dark min-h-12 px-6">
            {saving ? "Saving…" : "Save profile"}
          </button>
          {savedAt && <span className="text-sm text-[var(--gold-strong)]">Saved ✓ {savedAt.toLocaleTimeString()}</span>}
          <Link href="/scan/barcode" className="ml-auto inline-flex min-h-12 items-center rounded-xl btn btn-secondary px-5 font-bold text-[var(--gold-strong)]">Start scanning →</Link>
        </div>

        <ul className="text-[11px] text-[var(--muted)] list-disc pl-5 space-y-1">
          {ALL_DISCLAIMERS.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </form>
    </main>
  );
}
