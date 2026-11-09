import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { askWithGemini, isGeminiConfigured } from "@/lib/gemini";
import { ALL_DISCLAIMERS } from "@/lib/disclaimers";

const BodySchema = z.object({
  question: z.string().min(2).max(500),
  language: z.enum(["en", "hi", "es"]).optional().default("en"),
  profile: z
    .object({
      goals: z.array(z.string().max(60)).max(20).default([]),
      allergies: z.array(z.string().max(80)).max(30).default([]),
      avoidList: z.array(z.string().max(80)).max(50).default([]),
    })
    .optional(),
  productContext: z
    .object({
      name: z.string().max(200).optional().default(""),
      rating: z.string().max(20).optional().default(""),
      shortSummary: z.string().max(400).optional().default(""),
    })
    .optional(),
});

const FALLBACK: Record<string, { answer: string; suggestions: string[] }> = {
  en: { answer: "I can't reach the AI right now. General tips below — always read the physical pack and consult a professional for medical questions.", suggestions: ["Choose products whose first ingredient is a whole food.", "For gym goals, look for 10g+ protein per serving and manageable sugars (<10g).", "Check the allergen statement, not just the ingredient list."] },
  hi: { answer: "मैं अभी AI से जुड़ नहीं पा रहा। सामान्य सुझाव नीचे हैं — हमेशा पैकेट की जाँच करें और चिकित्सा प्रश्नों के लिए डॉक्टर से मिलें।", suggestions: ["जिसका पहला घटक साबुत खाद्य हो, वही चुनें।", "जिम के लिए प्रोटीन 10g+ और शुगर कम हो।", "एलर्जी के लिए पूरी सामग्री नहीं, 'Contains' कथन भी देखें।"] },
  es: { answer: "No puedo conectar con la IA ahora. Consejos generales abajo — siempre revisa el empaque y consulta a un profesional para temas médicos.", suggestions: ["Elige productos cuyo primer ingrediente sea un alimento integral.", "Para el gimnasio, busca 10g+ de proteína y menos de 10g de azúcar por porción.", "Revisa también el aviso de alérgenos, no solo la lista de ingredientes."] },
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ask a short question (2–500 chars)." }, { status: 400 });
  }
  const { question, language, profile, productContext } = parsed.data;

  if (!isGeminiConfigured()) {
    return NextResponse.json({ ...FALLBACK[language], aiAvailable: false, disclaimers: ALL_DISCLAIMERS });
  }
  try {
    const result = await askWithGemini({ question, language, profile, productContext });
    return NextResponse.json({ ...result, aiAvailable: true, disclaimers: ALL_DISCLAIMERS });
  } catch (err) {
    console.error("[ask] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ...FALLBACK[language], aiAvailable: false, disclaimers: ALL_DISCLAIMERS });
  }
}
