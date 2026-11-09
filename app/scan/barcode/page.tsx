"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type PendingProduct } from "@/components/AppProvider";
import { useLanguage } from "@/components/LanguageProvider";

const OFF_API = (barcode: string) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

const num = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
};

function stripLangTag(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim().toLowerCase();
}

type OffProduct = {
  product_name?: string;
  product_name_en?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
  image_front_url?: string;
  image_front_small_url?: string;
};

function mapOffProduct(barcode: string, p: OffProduct): PendingProduct {
  const n = p.nutriments ?? {};
  const sodiumG = num(n.sodium_100g);
  const energyKcal = num(n["energy-kcal_100g"], n["energy-kcal_serving"]) ?? (num(n.energy_100g) !== null ? Math.round(Number(num(n.energy_100g)) / 4.184) : null);

  const contains = [
    (p.allergens_tags ?? []).length ? `Contains: ${(p.allergens_tags ?? []).map(stripLangTag).join(", ")}.` : "",
    (p.traces_tags ?? []).length ? `May contain traces of: ${(p.traces_tags ?? []).map(stripLangTag).join(", ")}.` : "",
  ].filter(Boolean).join("\n");

  return {
    source: "barcode",
    barcode,
    name: (p.product_name_en || p.product_name || "").trim(),
    ingredients: (p.ingredients_text_en || p.ingredients_text || "").trim(),
    containsStatement: contains || "No allergen statement found on file.",
    nutritionPer100g: {
      energyKcal,
      fat: num(n.fat_100g),
      saturatedFat: num(n["saturated-fat_100g"]),
      carbohydrate: num(n.carbohydrates_100g),
      sugars: num(n.sugars_100g),
      addedSugars: num(n["added-sugars_100g"]),
      protein: num(n.proteins_100g, n.protein_100g),
      fiber: num(n.fiber_100g, n["fiber_100g"]),
      salt: num(n.salt_100g),
      sodiumMg: sodiumG !== null ? Math.round(sodiumG * 1000) : null,
    },
    servingSize: p.serving_size?.trim() || "",
    imageUrls: [],
    productImageUrl: p.image_front_url || p.image_front_small_url || undefined,
  };
}

export default function BarcodePage() {
  const router = useRouter();
  const { setPendingProduct } = useApp();
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => { void stopScanner(); }, [stopScanner]); // camera off when leaving page

  const lookup = useCallback(async (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!/^\d{6,14}$/.test(barcode)) {
      setError("Barcodes are 6–14 digits (EAN/UPC). Check the number and try again.");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(OFF_API(barcode));
      if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
      const data = (await res.json()) as { status: number | string; product?: OffProduct };
      if (String(data.status) !== "1" || !data.product) {
        setError("Product not found in Open Food Facts. Try " + "“Take Photo” and OCR the label instead.");
        return;
      }
      setPendingProduct(mapOffProduct(barcode, data.product));
      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Open Food Facts. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [router, setPendingProduct]);

  const startScanner = useCallback(async () => {
    setError("");
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const elementId = "nutriscan-barcode-reader";
      // Ensure the container exists before Html5Qrcode looks it up
      await new Promise((r) => setTimeout(r, 50));
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => {
          void stopScanner().then(() => lookup(decoded));
        },
        () => { /* frame without a barcode — ignore */ }
      );
    } catch (err) {
      console.error(err);
      setError("Camera access failed. Grant camera permission, use HTTPS, or type the barcode in manually below.");
      setScanning(false);
    }
  }, [lookup, stopScanner]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 pb-16">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm font-semibold text-[var(--gold-strong)] min-h-11 flex items-center">← Home</Link>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--gold-strong)]">OPEN FOOD FACTS · FREE</span>
      </header>

      <h1 className="mt-2 text-3xl font-black text-[var(--text)]">{t("scan.barcodeTitle")}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Point the camera at the barcode — or type it in. You&apos;ll always get to review the data before the AI verdict.</p>

      {/* Camera viewport */}
      <div ref={containerRef} className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
        <div id="nutriscan-barcode-reader" className="w-full" aria-label="Barcode camera viewfinder" />
        {!scanning && (
          <div className="flex flex-col items-center gap-3 bg-[color-mix(in_srgb,var(--mocha-2)_90%,transparent)] px-6 py-10 text-center text-[#f7e9d5]">
            <span className="text-5xl" aria-hidden>🔍</span>
            <p className="text-sm text-[#cfb39e]">Camera is off. Start it, or type the barcode instead.</p>
            <button onClick={startScanner} className="min-h-12 rounded-xl bg-[var(--surface)]0 px-6 font-bold text-[var(--text)] shadow">Start camera</button>
          </div>
        )}
      </div>
      {scanning && (
        <button onClick={() => void stopScanner()} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] font-semibold text-[var(--text)]">Stop camera</button>
      )}

      {/* Manual entry */}
      <form onSubmit={(e) => { e.preventDefault(); void lookup(manual); }} className="mt-4 panel p-4">
        <label htmlFor="manual" className="text-sm font-bold text-[var(--text)]">Or enter barcode digits</label>
        <div className="mt-2 flex gap-2">
          <input id="manual" inputMode="numeric" pattern="\d*" className="min-h-12 flex-1 rounded-xl border border-[var(--border)] px-3 tracking-widest" placeholder="5000112637922" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} />
          <button type="submit" disabled={loading || manual.length < 6} className="btn btn-dark min-h-12 px-5">
            {loading ? "…" : "Look up"}
          </button>
        </div>
      </form>

      {error && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[var(--amber-deep)]" role="alert">{error}</p>}

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Camera not working? <Link href="/scan/photo" className="font-bold underline">Use Photo mode instead →</Link>
      </p>
    </main>
  );
}
