// Deterministic label-text parser (ported from the v1 prototype to TypeScript).
// No AI — conservative regex extraction; unfound fields stay null for manual entry.

// Numbers per nutrient; `servingSize` is a string — everything else nullable numbers.
export type NutritionMap = Record<string, number | string | null>;

export type ParsedLabel = {
  ingredients: string;
  containsStatement: string;
  servingSizeGrams: number | null;
  nutritionPer100g: NutritionMap; // per serving when labelled per-serving, else scaled estimate — UI labels it honestly
  meta: {
    per100Only: boolean;
    scaledToServing: boolean;
    ingredientsFound: boolean;
    allergensFound: boolean;
    missingFields: string[];
  };
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNum = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const firstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
};

function extractSection(text: string, startKeywords: string[], endKeywords: string[] = []): string {
  const lower = text.toLowerCase();
  for (const kw of startKeywords) {
    const i = lower.indexOf(kw);
    if (i === -1) continue;
    const rest = text.slice(i + kw.length);
    let end = rest.length;
    for (const ek of endKeywords) {
      const j = rest.toLowerCase().indexOf(ek);
      if (j > 0 && j < end) end = j;
    }
    return rest.slice(0, end).replace(/^[:\s\-–—.]+/, "").trim();
  }
  return "";
}

export const SAMPLE_OCR = `CHOCO CRUNCH BAR
Ingredients: Sugar, wheat flour, milk chocolate (sugar, cocoa mass, cocoa butter, skimmed milk powder, butter fat, emulsifier (soy lecithin)), glucose syrup, coconut oil, cocoa powder (3%), whey powder, barley malt extract, salt, raising agent (sodium bicarbonate), vanilla extract.
Contains: milk, soy, wheat.
May contain traces of peanut and almond.
Typical values per 100g: Energy 2100 kJ / 500 kcal; Fat 22g of which saturates 14g; Carbohydrate 60g of which sugars 42g; Protein 7g; Fibre 4g; Salt 0.6g.
Serving size 35g`;

export function parseLabelText(rawText: string): ParsedLabel {
  const text = String(rawText || "");
  const lower = text.toLowerCase();

  // Ingredients
  const ingredients = extractSection(text, ["ingredients"], ["nutrition", "allergens", "contains", "typical values", "per 100", "storage", "directions", "net weight"]);

  // Contains / may-contain statements
  const contains = extractSection(text, ["contains:", "contains "], ["may contain", "nutrition", "ingredients", "storage"]);
  const mayContain = extractSection(
    text,
    ["may contain", "traces of", "produced in", "manufactured in", "packed in"],
    ["nutrition", "storage", "directions"]
  );
  const containsStatement = [contains && `Contains: ${contains}`, mayContain && `May contain: ${mayContain}`]
    .filter(Boolean)
    .join("\n");

  // Serving size
  const servingMatch = text.match(new RegExp(String.raw`(?:serving|portion|per pack|per bar|per biscuit)[^0-9]{0,30}${NUM}\s*(g|ml)`, "i"));
  const servingSizeGrams = servingMatch ? toNum(servingMatch[1]) : null;
  const servingSize = servingMatch ? `${toNum(servingMatch[1])}${(servingMatch[2] ?? "g").toLowerCase()}` : "";

  // Per-100g detection
  const per100 = /per\s*100\s*(g|ml)/i.test(text);
  const perServing = /per\s*(serving|portion|pack|bar|biscuit|100\s*kcal)/i.test(text);

  const grab = (patterns: RegExp[]) => toNum(firstMatch(text, patterns));

  const energyKcal = grab([
    new RegExp(String.raw`energy[^0-9]{0,40}${NUM}\s*kcal`, "i"),
    new RegExp(String.raw`(?:^|[^0-9])${NUM}\s*kcal`, "i"),
    new RegExp(String.raw`calories[^0-9]{0,20}${NUM}`, "i"),
  ]);
  const fat = grab([new RegExp(String.raw`(?:total\s*)?fat[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const saturatedFat = grab([new RegExp(String.raw`sat(?:urated)?(?:\s*fat)?[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const carbohydrate = grab([new RegExp(String.raw`carb(?:ohydrate)?s?[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const sugars = grab([new RegExp(String.raw`sugars?[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const protein = grab([new RegExp(String.raw`protein[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const fiber = grab([new RegExp(String.raw`fib(?:re|er)[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);
  const salt = grab([new RegExp(String.raw`salt[^0-9a-z]{0,15}${NUM}\s*g`, "i")]);

  const sodiumNum = grab([new RegExp(String.raw`sodium[^0-9a-z]{0,15}${NUM}\s*(g|mg)`, "i")]);
  const sodiumUnit = (text.match(new RegExp(String.raw`sodium[^0-9a-z]{0,15}\d+(?:[.,]\d+)?\s*(g|mg)`, "i")) ?? [])[1];
  const sodiumMg = sodiumNum !== null ? (sodiumUnit?.toLowerCase() === "g" ? Math.round(sodiumNum * 1000) : Math.round(sodiumNum)) : null;

  // Scale per-100g values to serving size when possible
  const scale = per100 && !perServing && servingSizeGrams ? servingSizeGrams / 100 : 1;
  const sc = (v: number | null) => (v === null ? null : Math.round(v * scale * 100) / 100);

  const nutritionPer100g: NutritionMap = {
    energyKcal: sc(energyKcal),
    fat: sc(fat),
    saturatedFat: sc(saturatedFat),
    carbohydrate: sc(carbohydrate),
    sugars: sc(sugars),
    addedSugars: null,
    protein: sc(protein),
    fiber: sc(fiber),
    salt: sc(salt),
    sodiumMg: sodiumMg !== null ? Math.round(sodiumMg * scale) : null,
    servingSize,
  };

  const missingFields = Object.entries(nutritionPer100g)
    .filter(([k, v]) => k !== "servingSize" && k !== "addedSugars" && (v === null || v === ""))
    .map(([k]) => k);

  return {
    ingredients,
    containsStatement,
    servingSizeGrams,
    nutritionPer100g,
    meta: {
      per100Only: per100 && !perServing,
      scaledToServing: scale !== 1,
      ingredientsFound: Boolean(ingredients),
      allergensFound: Boolean(containsStatement),
      missingFields,
    },
  };
}
