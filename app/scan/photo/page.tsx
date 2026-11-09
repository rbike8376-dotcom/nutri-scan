"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type PendingProduct } from "@/components/AppProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { parseLabelText, SAMPLE_OCR } from "@/lib/parseLabel";

type Shot = { id: string; url: string; file: File; label: string };
let uid = 0;
const nextId = () => `shot-${Date.now()}-${uid++}`;

export default function PhotoPage() {
  const router = useRouter();
  const { setPendingProduct } = useApp();
  const { t, ocrLang } = useLanguage();
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  // Revoke object URLs only when leaving for good (verify page re-creates its own from pending state? No — keep them):
  // Verify page reads URLs from pendingProduct, so don't revoke on unmount here.
  useEffect(() => () => { /* URLs owned by pendingProduct after handoff */ }, []);

  const addFiles = (files: FileList | null, label: string) => {
    if (!files?.length) return;
    setShots((prev) => [
      ...prev,
      ...Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 6).map((file) => ({ id: nextId(), url: URL.createObjectURL(file), file, label })),
    ].slice(0, 6));
  };

  const removeShot = (id: string) =>
    setShots((prev) => {
      const t = prev.find((s) => s.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((s) => s.id !== id);
    });

  const handoff = (rawText: string, confidence: number, isDemo: boolean) => {
    const parsed = parseLabelText(rawText);
    setPendingProduct({
      source: "ocr",
      barcode: "",
      name: isDemo ? "Choco Crunch Bar (demo)" : "",
      ingredients: parsed.ingredients,
      containsStatement: parsed.containsStatement,
      nutritionPer100g: parsed.nutritionPer100g,
      servingSize: String(parsed.nutritionPer100g.servingSize ?? ""),
      imageUrls: shots.map((s) => s.url),
      rawText,
      confidence,
      demoSample: isDemo,
    });
    router.push("/verify");
  };

  const runOcr = async () => {
    if (!shots.length) return;
    setBusy(true); setError(""); setProgress(0); setStage("Loading OCR engine…");
    try {
      const Tesseract = await import("tesseract.js");
      const texts: string[] = [];
      let confSum = 0, confCount = 0;
      for (let i = 0; i < shots.length; i += 1) {
        setStage(`Reading image ${i + 1} of ${shots.length}…`);
        const { data } = await Tesseract.default.recognize(shots[i].file, ocrLang, {
          logger: (m: { status: string; progress?: number }) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              const span = 100 / shots.length;
              setProgress(Math.round((i / shots.length) * 100 + m.progress * span));
            }
          },
        });
        texts.push(data.text || "");
        if (typeof data.confidence === "number") { confSum += data.confidence; confCount += 1; }
      }
      handoff(texts.join("\n\n"), confCount ? Math.round(confSum / confCount) : 0, false);
    } catch (err) {
      console.error(err);
      setError("OCR failed on this device. Try a clearer, well-lit shot — or load the demo sample below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">← Home</Link>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--gold-strong)]">ON-DEVICE OCR · PRIVATE</span>
      </header>

      <h1 className="mt-2 text-3xl font-black text-[var(--text)]">{t("scan.photoTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Take one or more photos — ingredients list, nutrition panel, allergen statement. Everything is read locally on your phone.</p>

      <div className="mt-4 flex flex-wrap justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-5">
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-[var(--mocha)] px-5 font-bold text-white">
          📸 Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addFiles(e.target.files, "Camera")} aria-label="Take a photo of the label" />
        </label>
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl btn btn-secondary px-5 font-bold text-[var(--gold-strong)]">
          🖼️ From gallery
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files, "Gallery")} aria-label="Choose label images from gallery" />
        </label>
      </div>

      {shots.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {shots.map((s) => (
            <figure key={s.id} className="relative">
              <button onClick={() => removeShot(s.id)} aria-label="Remove image" className="absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-red-700 text-sm font-bold text-white">×</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="Label capture" className="h-24 w-full rounded-xl border border-[var(--border)] object-cover" />
            </figure>
          ))}
        </div>
      )}

      {busy ? (
        <div className="mt-4 panel p-4" aria-live="polite">
          <strong className="text-[var(--text)]">{stage}</strong>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--gold-strong)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">{progress}% — keep this tab open.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button onClick={runOcr} disabled={!shots.length} className="btn btn-dark min-h-12 px-6">🔍 Read label</button>
          <button onClick={() => handoff(SAMPLE_OCR, 92, true)} className="min-h-12 rounded-xl btn btn-secondary px-6 font-bold text-[var(--gold-strong)]">✨ Load demo sample</button>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[var(--amber-deep)]" role="alert">{error}</p>}

      <div className="mt-5 panel p-4 text-xs text-[var(--muted)] shadow-sm">
        <strong className="text-[var(--text)]">Tips for a clean read:</strong> flat surface · even light · fill the frame · one section per shot · no glare.
      </div>
    </main>
  );
}
