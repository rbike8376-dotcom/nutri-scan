import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeWithGemini, isGeminiConfigured, type ProfileInput, type ProductInput } from "@/lib/gemini";
import { basicAllergenCheck, ratingFromRisks, type FallbackRisk } from "@/lib/allergens";
import { logScan, isSheetsConfigured } from "@/lib/sheets";
import { resolveUserId } from "@/lib/auth-context";
import { ALL_DISCLAIMERS } from "@/lib/disclaimers";

// Note: Next 16 cacheComponents — no `runtime`/`dynamic` exports in route config.

// Best-effort per-IP rate limit for the free Gemini tier (serverless: per instance).
const WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const NutritionSchema = z
  .object({
    servingSize: z.string().max(80).optional(),
    energyKcal: z.number().nullable().optional(),
    fat: z.number().nullable().optional(),
    saturatedFat: z.number().nullable().optional(),
    carbohydrate: z.number().nullable().optional(),
    sugars: z.number().nullable().optional(),
    addedSugars: z.number().nullable().optional(),
    protein: z.number().nullable().optional(),
    fiber: z.number().nullable().optional(),
    salt: z.number().nullable().optional(),
    sodiumMg: z.number().nullable().optional(),
  })
  .passthrough(); // allow extra keys (e.g. per-100g labels) without failing

const BodySchema = z.object({
  userVerified: z.literal(true, { error: "Verification required. Confirm the extracted label details before analysis." }),
  profile: z.object({
    goals: z.array(z.string().max(60)).max(20).default([]),
    allergies: z.array(z.string().max(80)).max(30).default([]),
    avoidList: z.array(z.string().max(80)).max(50).default([]),
    prescriptionText: z.string().max(4000).optional().default(""),
    consentHistory: z.boolean().optional().default(false),
  }),
  product: z.object({
    source: z.enum(["barcode", "ocr"]),
    name: z.string().max(200).optional().default(""),
    ingredients: z.string().max(20000).default(""),
    containsStatement: z.string().max(5000).optional().default(""),
    nutritionPer100g: NutritionSchema.optional().default({}),
    servingSize: z.string().max(80).optional().default(""),
    barcode: z.string().max(64).optional().default(""),
  }),
  userId: z.string().max(80).optional().default(""),
  saveToHistory: z.boolean().optional().default(false),
  language: z.enum(["en", "hi", "es"]).optional().default("en"),
});

type FallbackVerdict = {
  rating: "good" | "caution" | "avoid";
  headline: string;
  shortSummary: string;
  simpleWords: string;
  calorieNote: string;
  buyOrSkip: string;
  reasons: string[];
  allergyRisks: FallbackRisk[];
  goalFit: { goal: string; verdict: "unknown"; note: string }[];
  alternatives: string[];
};

function fallbackVerdict(profile: ProfileInput, product: ProductInput): FallbackVerdict {
  const risks = basicAllergenCheck({
    ingredients: product.ingredients,
    containsStatement: product.containsStatement ?? "",
    allergies: profile.allergies,
  });
  const hasNutrition = Object.values(product.nutritionPer100g ?? {}).some((v) => typeof v === "number" && Number.isFinite(v));
  const rating = ratingFromRisks(risks, hasNutrition);
  const kcal = typeof product.nutritionPer100g?.energyKcal === "number" ? Math.round(product.nutritionPer100g.energyKcal) : null;
  const high = risks.some((r) => r.severity === "high");

  const reasons = risks.length
    ? risks.map((r) =>
        r.severity === "high"
          ? `Possible ${r.name} match in "${r.evidence}" — matches your declared allergy. Verify on the physical pack; if in doubt, do not consume.`
          : `Cross-contact wording referencing ${r.name} ("${r.evidence}") — relevant to your allergy. Verify with the manufacturer or pack.`
      )
    : ["No obvious keyword match for your declared allergies in the verified text. This is a limited check only — always read the physical pack."];

  return {
    rating,
    headline: high
      ? "Possible allergen match — verify before consuming"
      : risks.length
        ? "Use caution — cross-contact wording found"
        : "No allergy keyword match (limited check)",
    shortSummary: high
      ? "Not a fit for your allergy — check the pack before buying."
      : risks.length
        ? "Caution — the pack mentions your allergen in a 'may contain' note."
        : "No obvious allergy keyword found on the verified text.",
    simpleWords: high
      ? "Stop — this has something you are allergic to. Read the pack to be sure."
      : risks.length
        ? "Maybe be careful — the pack says it might touch your allergen."
        : "Looks okay for your allergies, but always read the pack.",
    calorieNote: kcal !== null
      ? `About ${kcal} kcal per ${product.servingSize?.trim() || "serving"} — ${kcal <= 150 ? "a light choice" : kcal <= 400 ? "a moderate choice" : "a calorie-dense choice"} for snacking.`
      : "Calories not found on the label — check the pack.",
    buyOrSkip: high
      ? "Skip — allergen match for you."
      : risks.length
        ? "Caution — only if the pack is clearly acceptable to you."
        : "No allergy keyword found — still verify the pack.",
    reasons,
    allergyRisks: risks,
    goalFit: profile.goals.map((g) => ({
      goal: g,
      verdict: "unknown",
      note: "AI unavailable — goal-specific guidance is paused. Showing label facts only.",
    })),
    alternatives: [
      "Compare with a plain, single-ingredient alternative (e.g. unsalted nuts over chocolate-covered mix).",
      "Choose the lower-sugar, lower-saturated-fat option on the same shelf.",
      "For gym goals, look for 10g+ protein per serving with added sugars under 10g.",
    ],
  };
}

export async function POST(req: NextRequest) {
  // Rate limit by IP (best effort on serverless)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many analyses — please wait a while (free AI tier)." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: msg, code: "VERIFICATION_REQUIRED" }, { status: 400 });
  }
  const { profile, product, userId, saveToHistory, language } = parsed.data;

  if (!product.ingredients.trim() && !product.containsStatement?.trim()) {
    return NextResponse.json(
      { error: "Ingredients or a contains-statement must be provided (verified text).", code: "MISSING_LABEL_TEXT" },
      { status: 400 }
    );
  }

  const cleanNutrition: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(product.nutritionPer100g)) {
    if (k === "servingSize") continue;
    if (typeof v === "number" && Number.isFinite(v)) cleanNutrition[k] = v;
    else if (v === null) cleanNutrition[k] = null;
  }

  const profileInput: ProfileInput = {
    goals: profile.goals.map((g) => g.trim()).filter(Boolean),
    allergies: profile.allergies.map((a) => a.trim()).filter(Boolean),
    avoidList: profile.avoidList.map((a) => a.trim()).filter(Boolean),
    prescriptionText: profile.prescriptionText.trim() || undefined,
  };
  const productInput: ProductInput = {
    source: product.source,
    name: product.name.trim(),
    ingredients: product.ingredients.trim(),
    containsStatement: product.containsStatement?.trim() ?? "",
    nutritionPer100g: cleanNutrition,
    servingSize: product.servingSize?.trim() ?? "",
  };

  // --- Analyze: Gemini first, deterministic keyword fallback on any failure ---
  let aiAvailable = true;
  let verdict;
  try {
    if (!isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED");
    verdict = await analyzeWithGemini(profileInput, productInput, language);
  } catch (err) {
    console.error("[analyze] Gemini unavailable/invalid — using fallback:", err instanceof Error ? err.message : err);
    aiAvailable = false;
    verdict = fallbackVerdict(profileInput, productInput);
  }

  // --- Log to Google Sheets (best effort; never blocks the response on failure) ---
  // A signed-in session wins over the client-supplied userId (ownership is server-enforced).
  const acting = await resolveUserId(userId);
  const effectiveUserId = acting.userId?.trim() ?? "";
  let logged = false;
  if (saveToHistory && effectiveUserId) {
    logged = await logScan({
      userId: effectiveUserId,
      productName: product.name.trim() || "Unknown product",
      barcode: product.barcode?.trim() || "",
      source: product.source,
      rating: verdict.rating,
      allergyRisks: verdict.allergyRisks.map((r) => `${r.name}(${r.severity})`),
      reasons: verdict.reasons,
      prescriptionContextUsed: Boolean(profile.prescriptionText?.trim()),
    });
  }

  return NextResponse.json({
    aiAvailable,
    verdict,
    disclaimers: ALL_DISCLAIMERS,
    logged,
    historyAvailable: isSheetsConfigured(),
  });
}
