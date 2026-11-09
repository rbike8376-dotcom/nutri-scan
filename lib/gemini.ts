// Gemini client — server-side only. Never import this from a client component.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const AnalyzeResultSchema = z.object({
  rating: z.enum(["good", "caution", "avoid"]),
  headline: z.string().min(1).max(200),
  shortSummary: z.string().min(1).max(320).default("Analysis complete."),
  simpleWords: z.string().max(320).default(""),
  calorieNote: z.string().max(320).default(""),
  buyOrSkip: z.string().max(200).default(""),
  reasons: z.array(z.string().min(1).max(400)).min(1).max(6),
  allergyRisks: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        severity: z.enum(["high", "medium", "low"]),
        evidence: z.string().max(200).default(""),
      })
    )
    .max(10)
    .default([]),
  goalFit: z
    .array(
      z.object({
        goal: z.string().min(1).max(80),
        verdict: z.enum(["good", "okay", "poor", "unknown"]),
        note: z.string().max(300),
      })
    )
    .max(12)
    .default([]),
  alternatives: z.array(z.string().min(1).max(140)).max(6).default([]),
});

export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;

export type ProfileInput = {
  goals: string[];
  allergies: string[];
  avoidList: string[];
  prescriptionText?: string;
};

export type ProductInput = {
  source: "barcode" | "ocr";
  name?: string;
  ingredients: string;
  containsStatement?: string;
  nutritionPer100g?: Record<string, number | null | undefined>;
  servingSize?: string;
};

export const SYSTEM_PROMPT = `You are a food-label analysis assistant inside NutriScan AI, a consumer app for every age group.
You are NOT a doctor, dietitian, or medical device. You must never diagnose, treat, or give prescription guidance.

Given the user's profile (goals, declared allergies, optional doctor's prescription text) and VERIFIED product label data, respond with ONLY strict JSON matching this exact schema:
{
  "rating": "good" | "caution" | "avoid",
  "headline": string (max 200 chars, plain language),
  "shortSummary": string (max 320 chars — 1–2 sentence plain answer a grandparent can understand: good fit or not, and the single biggest reason),
  "simpleWords": string (max 320 chars — maximum simplicity, as if explaining to a child; avoid jargon),
  "calorieNote": string (max 320 chars — calories per serving vs the serving size shown; practical: "light snack" / "hearty meal" / "high for a snack"; tie to gym/weight-loss if relevant; if kcal missing, say unknown),
  "buyOrSkip": string (max 200 chars — direct buy/skip guidance with the ONE deciding reason),
  "reasons": string[] (1-6 items, each citing the label evidence it relies on, max 400 chars each),
  "allergyRisks": [{ "name": string, "severity": "high" | "medium" | "low", "evidence": string }],
  "goalFit": [{ "goal": string, "verdict": "good" | "okay" | "poor" | "unknown", "note": string }],
  "alternatives": string[] (up to 6 short, actionable shopping suggestions grounded in the user's goals/allergies, e.g. "choose plain nuts without milk chocolate in the same aisle"; NO brand guarantees, NO invented product claims)
}

Absolute rules:
- Use ONLY the label text and user data provided. Never invent ingredients, nutrition values, or brand facts.
- If data needed for a judgement is missing/unreadable, emit verdict "unknown" and say the user must check the pack. Never guess.
- "May contain / traces of / shared line" statements = cross-contact risk (medium at most, or flag as caution), not proof of presence.
- Never claim a product is "safe", "risk-free", or medically suitable. Use fit language: "fits your goal", "use caution", "not a fit for your allergy".
- If the prescription text conflicts with food choices, do NOT give medical instructions; advise consulting their doctor.
- If a declared allergy clearly matches the ingredients, rating must be "avoid" and severity "high" with the matched evidence.
- Keep reasons short, precise and specific to the label data.
- Answer in the language requested by the user (default English). Keep the allergy keyword evidence strings in the original label language.`;

const LANG_NAMES: Record<string, string> = { en: "English", hi: "Hindi (हिंदी)", es: "Spanish (Español)" };

export function buildUserPrompt(profile: ProfileInput, product: ProductInput, language = "en"): string {
  const nutrition = product.nutritionPer100g
    ? Object.entries(product.nutritionPer100g)
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "not provided";

  return [
    "USER PROFILE",
    `Goals: ${profile.goals.join(", ") || "none stated"}`,
    `Declared allergies/intolerances: ${profile.allergies.join(", ") || "none stated"}`,
    `Avoid list (user preference): ${profile.avoidList.join(", ") || "none"}`,
    profile.prescriptionText?.trim()
      ? `Prescription/doctor report text (user-verified): ${profile.prescriptionText.trim().slice(0, 3000)}`
      : "Prescription text: not provided",
    "",
    "PRODUCT (user-verified label data — treat as ground truth)",
    `Source: ${product.source}`,
    `Name: ${product.name?.trim() || "unknown product"}`,
    `Serving size: ${product.servingSize?.trim() || "not stated"}`,
    `Ingredients: ${product.ingredients?.trim() || "not provided"}`,
    `Contains / may-contain statements: ${product.containsStatement?.trim() || "none stated"}`,
    `Nutrition (per 100g or per serving as labelled): ${nutrition}`,
    "",
    `REPLY LANGUAGE: ${LANG_NAMES[language] ?? "English"} — write every user-facing string in this language (keep evidence snippets as-is).`,
    "Task: rate fit for THIS user, citing evidence from the label text. Strict JSON only.",
  ].join("\n");
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

// Free-tier model chain — first success wins. Env override pins a single model.
const DEFAULT_MODEL_CHAIN = [
  "gemini-3.5-flash-lite", // verified working (fast, low demand)
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

function modelChain(): string[] {
  const pinned = process.env.GEMINI_MODEL?.trim();
  const chain = pinned ? [pinned] : DEFAULT_MODEL_CHAIN;
  return [...new Set(chain)];
}

/** General food assistant — answers "what should I buy / is this good for gym?"-style questions. */

export const AskResultSchema = z.object({
  answer: z.string().min(1).max(600),
  suggestions: z.array(z.string().min(1).max(160)).max(6).default([]),
});

export type AskResult = z.infer<typeof AskResultSchema>;

export async function askWithGemini(input: {
  question: string;
  language?: string;
  profile?: ProfileInput;
  productContext?: { name?: string; rating?: string; shortSummary?: string };
}): Promise<AskResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const language = input.language ?? "en";
  const p = input.profile;
  const context = [
    p ? `User profile — goals: ${p.goals.join(", ") || "none"}; allergies: ${p.allergies.join(", ") || "none"}; avoid: ${p.avoidList.join(", ") || "none"}.` : "User profile: not provided.",
    input.productContext
      ? `Last scanned product: ${input.productContext.name || "unknown"} — AI verdict: ${input.productContext.rating || "unknown"}${input.productContext.shortSummary ? ` — ${input.productContext.shortSummary}` : ""}.`
      : "Last scanned product: none.",
    `REPLY LANGUAGE: ${LANG_NAMES[language] ?? "English"}.`,
    "Rules: informational only — NOT medical advice. Never diagnose or treat. Keep it short (2–3 sentences) and practical. Give up to 5 concrete suggestion bullets. If the question needs medical judgement, tell them to ask a doctor. Use only the profile + product context provided; never invent label facts.",
  ].join("\n");

  const prompt = `${context}\n\nUSER QUESTION: ${input.question.slice(0, 500)}\n\nRespond with ONLY strict JSON: {"answer": string, "suggestions": string[]}`;

  const errors: string[] = [];
  for (const modelName of modelChain()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: "You are NutriScan AI, a friendly food-label assistant for every age. Informational only — not medical advice.",
          responseMimeType: "application/json",
          temperature: 0.35,
          maxOutputTokens: 700,
          abortSignal: AbortSignal.timeout(15000),
        },
      });
      return AskResultSchema.parse(extractJson(res.text ?? ""));
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/\s+/g, " ").slice(0, 160) : String(err);
      errors.push(`${modelName}: ${msg}`);
      console.warn(`[gemini/ask] ${modelName} failed: ${msg}`);
    }
  }
  throw new Error(`All Gemini models failed → ${errors.join(" | ")}`);
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

async function tryModel(apiKey: string, modelName: string, prompt: string): Promise<AnalyzeResult> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.2, // deterministic-ish, consistent verdicts
      maxOutputTokens: 2048,
      abortSignal: AbortSignal.timeout(15000),
    },
  });
  const text = res.text ?? "";
  return AnalyzeResultSchema.parse(extractJson(text));
}

export async function analyzeWithGemini(
  profile: ProfileInput,
  product: ProductInput,
  language = "en"
): Promise<AnalyzeResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const prompt = buildUserPrompt(profile, product, language);
  const errors: string[] = [];
  for (const modelName of modelChain()) {
    try {
      return await tryModel(apiKey, modelName, prompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/\s+/g, " ").slice(0, 220) : String(err);
      errors.push(`${modelName}: ${msg}`);
      console.warn(`[gemini] ${modelName} failed: ${msg}`);
    }
  }
  throw new Error(`All Gemini models failed → ${errors.join(" | ")}`);
}
