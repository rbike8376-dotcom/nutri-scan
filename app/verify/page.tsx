"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useApp } from "@/components/AppProvider";

const NUTRIENT_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "energyKcal", label: "Energy", unit: "kcal" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "saturatedFat", label: "Saturates", unit: "g" },
  { key: "carbohydrate", label: "Carbs", unit: "g" },
  { key: "sugars", label: "Sugars", unit: "g" },
  { key: "addedSugars", label: "Added sugars", unit: "g" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "salt", label: "Salt", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
];

const toInput = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const toNumOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function VerifyPage() {
  const router = useRouter();
  const { pendingProduct, profile, setVerdict, setDisclaimers, setAiAvailable, setLogged } = useApp();
  const { t, lang } = useLanguage();

  const [activeImage, setActiveImage] = useState(0);
  const [name, setName] = useState(pendingProduct?.name ?? "");
  const [ingredients, setIngredients] = useState(pendingProduct?.ingredients ?? "");
  const [containsStatement, setContainsStatement] = useState(pendingProduct?.containsStatement ?? "");
  const [nutrition, setNutrition] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of NUTRIENT_FIELDS) out[f.key] = toInput(pendingProduct?.nutritionPer100g?.[f.key] as number | null | undefined);
    return out;
  });
  const [servingSize, setServingSize] = useState(pendingProduct?.servingSize ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [saveToHistory, setSaveToHistory] = useState(Boolean(profile?.consentHistory));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const ingredientConfidence = useMemo((): "high" | "medium" | "low" => {
    if (!pendingProduct) return "low";
    if (pendingProduct.source === "barcode") return ingredients.trim() ? "high" : "low";
    const c = pendingProduct.confidence ?? 0;
    if (!ingredients.trim()) return "low";
    return c >= 75 ? "high" : c >= 50 ? "medium" : "low";
  }, [pendingProduct, ingredients]);

  if (!pendingProduct) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="panel p-8 shadow-sm">
          <div className="text-5xl" aria-hidden>🧾</div>
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--text)]">Nothing to verify yet</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Scan a barcode or photograph a label first — we analyze only what you&apos;ve confirmed.</p>
          <Link href="/" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--mocha)] px-6 font-bold text-white">← Back to home</Link>
        </div>
      </main>
    );
  }

  const images = pendingProduct.imageUrls;
  const ingredientsOk = ingredients.trim().length > 0;
  const containsOk = containsStatement.trim().length > 0;
  const canSubmit = ingredientsOk && containsOk && confirmed && !submitting;

  const badge =
    ingredientConfidence === "high" ? "bg-[var(--surface-2)] text-[var(--gold-strong)]"
    : ingredientConfidence === "medium" ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-800";

  const confirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(""); setLogged(false);
    try {
      const nutritionPayload: Record<string, number | null> = {};
      for (const f of NUTRIENT_FIELDS) nutritionPayload[f.key] = toNumOrNull(nutrition[f.key]);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userVerified: true,
          profile: {
            goals: profile?.goals ?? [],
            allergies: profile?.allergies ?? [],
            avoidList: profile?.avoidList ?? [],
            prescriptionText: profile?.prescriptionText ?? "",
            consentHistory: Boolean(profile?.consentHistory),
          },
          product: {
            source: pendingProduct.source,
            barcode: pendingProduct.barcode,
            name,
            ingredients: ingredients.trim(),
            containsStatement: containsStatement.trim(),
            nutritionPer100g: nutritionPayload,
            servingSize: servingSize.trim(),
          },
          userId: profile?.userId ?? "",
          saveToHistory,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Analysis failed (${res.status})`);
      setVerdict(data.verdict);
      setDisclaimers(data.disclaimers ?? []);
      setAiAvailable(Boolean(data.aiAvailable));
      setLogged(Boolean(data.logged));
      router.push("/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Is your Gemini key configured in .env.local?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href={pendingProduct.source === "barcode" ? "/scan/barcode" : "/scan/photo"} className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">← Rescan</Link>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-[var(--amber-deep)]">MANDATORY · YOU VERIFY</span>
      </header>

      <h1 className="mt-2 text-3xl font-black text-[var(--text)]">{t("verify.title")}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Check every value against the pack — especially allergens — then confirm. The AI only ever sees what you approve.</p>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-start">
        {/* Left: reference (product photo / captured images / barcode card) */}
        <section className="lg:sticky lg:top-6">
          {pendingProduct.productImageUrl ? (
            <figure className="overflow-hidden panel shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingProduct.productImageUrl} alt={pendingProduct.name || "Product from Open Food Facts"} loading="lazy" decoding="async" className="h-56 w-full object-contain bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)]" />
              <figcaption className="px-4 py-2 text-xs text-[var(--muted)]">Image from Open Food Facts{pendingProduct.name ? ` · ${pendingProduct.name}` : ""}</figcaption>
            </figure>
          ) : images.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[activeImage]} alt={`Label capture ${activeImage + 1}`} className="max-h-[60vh] w-full object-contain" />
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Select captured image">
                {images.map((url, i) => (
                  <button key={i} role="tab" aria-selected={i === activeImage} onClick={() => setActiveImage(i)} className={`rounded-lg border-2 p-0.5 ${i === activeImage ? "border-[var(--gold)]" : "border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={url} alt={`Thumbnail ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="panel p-6">
              <div className="text-4xl" aria-hidden>🏷️</div>
              <h2 className="mt-2 font-extrabold text-[var(--text)]">{pendingProduct.name || "Product"}</h2>
              {pendingProduct.barcode && <p className="mt-1 text-sm text-[var(--muted)]">Barcode: <span className="font-mono">{pendingProduct.barcode}</span></p>}
              <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">Source: {pendingProduct.source === "barcode" ? "Open Food Facts" : "OCR (on-device)"}{pendingProduct.demoSample ? " · DEMO SAMPLE" : ""}</p>
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">Compare the text on the right with the image. Anything uncertain should be corrected by hand.</p>
        </section>

        {/* Right: editable verified data */}
        <section className="flex flex-col gap-4">
          <div className="panel p-4">
            <label htmlFor="name" className="text-sm font-bold text-[var(--text)]">Product name</label>
            <input id="name" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Choco Crunch Bar" />
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="ingredients" className="text-sm font-bold text-[var(--text)]">Ingredients *</label>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badge}`}>{ingredientConfidence === "high" ? "high confidence" : ingredientConfidence === "medium" ? "check me" : "low confidence — edit"}</span>
            </div>
            <textarea id="ingredients" required className={`mt-1 min-h-28 w-full rounded-xl border p-3 text-sm ${ingredientConfidence === "low" ? "border-amber-400 bg-amber-50/40" : "border-[var(--border)]"}`} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Sugar, wheat flour, milk chocolate…" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Copy exactly, e.g. “soy lecithin”, “whey powder”, “barley malt”. Wording drives allergen matching.</p>
          </div>

          <div className="panel p-4">
            <label htmlFor="contains" className="text-sm font-bold text-[var(--text)]">Contains / “may contain” statement *</label>
            <textarea id="contains" required className="mt-1 min-h-20 w-full rounded-xl border border-[var(--border)] p-3 text-sm" value={containsStatement} onChange={(e) => setContainsStatement(e.target.value)} placeholder={"Contains: milk, soy, wheat.\nMay contain traces of peanut."} />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Nothing listed? Type “None declared”. Illegible? Type “Unclear — verify on pack”.</p>
          </div>

          <fieldset className="panel p-4">
            <legend className="px-1 text-sm font-bold text-[var(--text)]">Nutrition</legend>
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NUTRIENT_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-[11px] font-medium text-[var(--text)]/80">
                  {f.label} ({f.unit})
                  <input inputMode="decimal" className="min-h-11 rounded-lg border border-[var(--border)] px-2 text-sm" value={nutrition[f.key]} onChange={(e) => setNutrition({ ...nutrition, [f.key]: e.target.value })} placeholder="—" />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--text)]/80">
                Serving size
                <input className="min-h-11 rounded-lg border border-[var(--border)] px-2 text-sm" value={servingSize} onChange={(e) => setServingSize(e.target.value)} placeholder="e.g. 35g" />
              </label>
            </div>
          </fieldset>

          <label className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-amber-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className="text-sm text-[var(--amber-deep)]"><strong>{t("verify.iChecked")}</strong> (or the Open Food Facts entry for this barcode) and they are correct as far as I can tell.</span>
          </label>

          {profile && (
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-3 cursor-pointer">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--gold-strong)]" checked={saveToHistory} onChange={(e) => setSaveToHistory(e.target.checked)} />
              <span className="text-sm"><strong>Save this verdict to my history</strong> ({profile.consentHistory ? "enabled in your profile" : "one-time — or enable it in Profile"}). Photos are never stored.</span>
            </label>
          )}

          {error && <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

          <button onClick={confirm} disabled={!canSubmit} className="min-h-14 rounded-2xl bg-[var(--mocha)] px-6 text-lg font-black text-white shadow disabled:opacity-50">
            {submitting ? "Asking the AI…" : <>✅ {t("verify.confirm")}</>}
          </button>
          {!ingredientsOk && <p className="text-xs text-[var(--muted)]">Ingredients are required (“None declared” if absent).</p>}
          {!containsOk && <p className="text-xs text-[var(--muted)]">The contains statement is required (“None declared” if absent).</p>}
        </section>
      </div>
    </main>
  );
}
