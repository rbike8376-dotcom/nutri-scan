"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { useLanguage } from "@/components/LanguageProvider";
import SpeakButton from "@/components/SpeakButton";
import SpeakListButton from "@/components/SpeakListButton";
import { useAppSettings } from "@/components/SettingsProvider";
import VoiceButton from "@/components/VoiceButton";

const NUTRIENT_LABELS: Record<string, string> = {
  energyKcal: "Energy", fat: "Fat", saturatedFat: "Saturates", carbohydrate: "Carbs",
  sugars: "Sugars", addedSugars: "Added sugars", protein: "Protein", fiber: "Fiber", salt: "Salt", sodiumMg: "Sodium",
};
const NUTRIENT_UNITS: Record<string, string> = {
  energyKcal: "kcal", fat: "g", saturatedFat: "g", carbohydrate: "g",
  sugars: "g", addedSugars: "g", protein: "g", fiber: "g", salt: "g", sodiumMg: "mg",
};

const RATING = {
  good: { label: "Good Fit", emoji: "🟢", wrap: "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-[var(--text)]", chip: "bg-[var(--gold-strong)]" },
  caution: { label: "Use Caution", emoji: "🟡", wrap: "border-amber-400 bg-amber-50 text-[var(--amber-deep)]", chip: "bg-amber-500" },
  avoid: { label: "Not a Fit", emoji: "🔴", wrap: "border-red-400 bg-red-50 text-red-900", chip: "bg-red-600" },
} as const;

export default function ResultPage() {
  const { verdict, disclaimers, aiAvailable, logged, pendingProduct, profile, clearPending } = useApp();
  const { t, lang } = useLanguage();
  const { settings } = useAppSettings();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [askAiAvailable, setAskAiAvailable] = useState(true);

  if (!verdict) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="panel p-8">
          <div className="text-5xl" aria-hidden>🥗</div>
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--text)]">No verdict yet</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Verify a label first — every verdict is built on data you confirmed yourself.</p>
          <Link href="/" className="btn btn-dark mt-5 min-h-12 px-6">← Home</Link>
        </div>
      </main>
    );
  }

  const r = RATING[verdict.rating];
  const speakText = [verdict.shortSummary, ...verdict.reasons.slice(0, 3), verdict.buyOrSkip].filter(Boolean).join(". ");

  const ask = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 2 || asking) return;
    setAsking(true); setAnswer(""); setSuggestions([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          language: lang,
          profile: { goals: profile?.goals ?? [], allergies: profile?.allergies ?? [], avoidList: profile?.avoidList ?? [] },
          productContext: { name: pendingProduct?.name ?? "", rating: verdict.rating, shortSummary: verdict.shortSummary },
        }),
      });
      const data = await res.json();
      setAnswer(data.answer ?? "");
      setSuggestions(data.suggestions ?? []);
      setAskAiAvailable(Boolean(data.aiAvailable));
    } catch {
      setAnswer("Couldn't reach the AI — check your connection and try again.");
      setAskAiAvailable(false);
    } finally {
      setAsking(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href="/history" className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">{t("nav.history")} →</Link>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">{pendingProduct?.source === "barcode" ? "Open Food Facts" : "Photo OCR"}</span>
      </header>

      {/* Verdict banner — animated pop */}
      <div className={`verdict-pop mt-3 rounded-3xl border-2 ${r.wrap} p-6 text-center shadow-md`} role="status">
        <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">{pendingProduct?.name || "Scanned product"}</div>
        <div className="mt-1 text-6xl font-black leading-none">{r.emoji}</div>
        <div className="mt-1 text-3xl sm:text-4xl font-black tracking-tight">{r.label}</div>
        <p className="mx-auto mt-3 max-w-prose text-lg font-semibold leading-snug">{verdict.shortSummary}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <SpeakButton text={speakText} />
          {verdict.buyOrSkip && <span className="rounded-full bg-[var(--panel)]/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--text)]">{verdict.buyOrSkip}</span>}
        </div>
        {!aiAvailable && (
          <p className="mx-auto mt-3 inline-flex rounded-full bg-amber-200/70 px-3 py-1 text-[10px] font-bold text-[var(--amber-deep)]">
            ⚠ AI unavailable — built-in basic safety check, not full AI analysis. Verify the pack.
          </p>
        )}
        {logged && <p className="mt-2 text-xs font-semibold text-[var(--gold-strong)]">✓ Saved to your history</p>}
      </div>

      {/* Simple words */}
      {verdict.simpleWords && (
        <section className="mt-4 panel p-5">
          <h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">🧒 {t("result.simpleLabel")}</h2>
          <p className="mt-1 text-base leading-snug text-[var(--text)]">{verdict.simpleWords}</p>
        </section>
      )}

      {/* Calories & fit */}
      {verdict.calorieNote && (
        <section className="mt-3 flex items-start gap-3 panel p-4">
          <span aria-hidden className="text-2xl">🔥</span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">{t("result.calorie")}</h2>
            <p className="mt-1 text-sm leading-snug text-[var(--text)]">{verdict.calorieNote}</p>
          </div>
        </section>
      )}

      {/* Why */}
      <section className="mt-4 panel p-5" aria-label="Why this verdict">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">{t("result.why")}</h2><SpeakListButton items={verdict.reasons} /></div>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {verdict.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-3 text-sm">
              <span aria-hidden className="mt-0.5 font-black text-[var(--gold-strong)]">{i + 1}.</span><span>{reason}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Allergy risks */}
      {verdict.allergyRisks.length > 0 && (
        <section className="mt-4 rounded-2xl border border-red-200 bg-[var(--panel)] p-5 shadow-sm" aria-label="Allergy risks">
          <div className="flex items-center gap-2"><h2 className="text-xs font-black uppercase tracking-wide text-red-800">⚠️ {t("result.allergy")}</h2><SpeakListButton items={verdict.allergyRisks.map((r) => `${r.name} (${r.severity})${r.evidence ? ` — matched ${r.evidence}` : ""}`)} /></div>
          <ul className="mt-2 flex flex-col gap-2">
            {verdict.allergyRisks.map((risk, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase text-white ${risk.severity === "high" ? "bg-red-600" : risk.severity === "medium" ? "bg-amber-500" : "bg-[var(--gold-strong)]"}`}>{risk.severity}</span>
                <strong>{risk.name}</strong>
                {risk.evidence && <span className="basis-full text-xs text-[var(--muted)]">matched: “{risk.evidence}”</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-red-800/80">Matches are based on the label text you verified. If in doubt, do not consume — contact the manufacturer.</p>
        </section>
      )}

      {/* Goal fit */}
      {verdict.goalFit.length > 0 && (
        <section className="mt-4 panel p-5" aria-label="Fit with your goals">
          <div className="flex items-center gap-2"><h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">{t("result.goalFit")}</h2><SpeakListButton items={verdict.goalFit.map((g) => `${g.goal}: ${g.verdict} — ${g.note}`)} /></div>
          <ul className="mt-2 flex flex-col gap-2">
            {verdict.goalFit.map((g, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-[var(--border)] p-3 text-sm">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${g.verdict === "good" ? "bg-[var(--gold-strong)] text-white" : g.verdict === "poor" ? "bg-red-600 text-white" : g.verdict === "okay" ? "bg-amber-500 text-white" : "bg-slate-300 text-slate-700"}`}>{g.verdict}</span>
                <strong className="text-[var(--text)]">{g.goal}</strong>
                <span className="basis-full text-xs text-[var(--muted)]">{g.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Alternatives */}
      {verdict.alternatives.length > 0 && (
        <section className="mt-4 panel p-5" aria-label="Better choices">
          <div className="flex items-center gap-2"><h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">🛒 {t("result.alternatives")}</h2><SpeakListButton items={verdict.alternatives} /></div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {verdict.alternatives.map((alt, i) => (
              <li key={i} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)]">{alt}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Label facts */}
      {pendingProduct && (
        <section className="mt-4 panel p-5" aria-label="Verified label facts">
          <h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">{t("result.labelFacts")} {pendingProduct.servingSize ? `(${pendingProduct.servingSize})` : ""}</h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(pendingProduct.nutritionPer100g).filter(([k]) => k !== "servingSize").map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-2 text-center">
                <div className="text-base font-extrabold text-[var(--text)]">{v ?? "—"}<span className="text-[10px] font-semibold"> {NUTRIENT_UNITS[k] ?? ""}</span></div>
                <div className="text-[10px] text-[var(--muted)]">{NUTRIENT_LABELS[k] ?? k}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ask the AI — voice-enabled */}
      {settings.features.ask && (
      <section className="mt-4 panel p-5" aria-label="Ask the AI">
        <h2 className="text-xs font-black uppercase tracking-wide text-[var(--gold-strong)]">💬 {t("ask.title")}</h2>
        <form onSubmit={ask} className="mt-2 flex items-stretch gap-2">
          <label className="sr-only" htmlFor="ask-input">Ask a question</label>
          <input id="ask-input" className="input min-h-12 flex-1 text-sm" placeholder={t("ask.placeholder")} value={question} onChange={(e) => setQuestion(e.target.value)} />
          {settings.features.voice && <VoiceButton onText={(txt) => setQuestion(txt)} />}
          <button type="submit" disabled={asking || question.trim().length < 2} className="btn btn-dark min-h-12 px-4">{asking ? "…" : t("ask.button")}</button>
        </form>
        {answer && (
          <div className="toast-in mt-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-3 text-sm text-[var(--text)]">
            <div className="flex items-start justify-between gap-2">
              <p className="leading-snug">{answer}</p>
              <SpeakButton text={answer} label="🔊" />
            </div>
            {suggestions.length > 0 && (
              <>
                <div className="mt-2 flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold-strong)]">Suggestions</span><SpeakListButton items={suggestions} /></div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text)]/85">
                  {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            {!askAiAvailable && <p className="mt-2 text-[10px] font-bold text-amber-800">AI unavailable — general tips only.</p>}
          </div>
        )}
      </section>
      )}

      {/* Disclaimers */}
      <section className="mt-4 rounded-2xl callout p-4 text-xs" aria-label="Medical disclaimers">
        <strong className="block text-sm">⚠️ {t("result.disclaimers")}</strong>
        <ul className="mt-1 list-disc space-y-1 pl-5">{disclaimers.map((d) => <li key={d}>{d}</li>)}</ul>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={() => { clearPending(); router.push("/"); }} className="btn btn-dark min-h-12 px-6">{t("common.scanAnother")}</button>
        <Link href="/onboarding" className="inline-flex min-h-12 items-center rounded-xl btn btn-secondary px-6 font-bold text-[var(--gold-strong)]">{t("nav.profile")}</Link>
      </div>
      {profile && <p className="mt-3 text-center text-[10px] text-[var(--muted)]">{profile.name || "anonymous"} · id {profile.userId.slice(0, 8)}…</p>}
    </main>
  );
}
