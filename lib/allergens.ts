// Last-resort safety net — runs ONLY when Gemini is unavailable or fails validation.
// Deliberately conservative: it never says "contains an allergen", only "possible match — verify on pack".

export type FallbackRisk = {
  name: string;
  severity: "high" | "medium" | "low";
  evidence: string;
};

const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ["peanut", "groundnut", "arachis", "monkey nut"],
  tree_nut: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "marzipan", "praline"],
  milk: ["milk", "whey", "casein", "lactose", "butter", "ghee", "cream", "cheese", "yoghurt", "yogurt"],
  egg: ["egg", "albumin", "mayonnaise", "meringue", "ovalbumin"],
  soy: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "tvp", "textured vegetable protein"],
  gluten: ["gluten", "wheat", "barley", "rye", "malt", "semolina", "spelt", "triticale"],
  fish: ["fish", "anchovy", "cod", "tuna", "salmon", "sardine", "mackerel"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "scampi", "krill", "oyster", "mussel", "squid", "octopus"],
  sesame: ["sesame", "tahini", "gomasio"],
  sulphites: ["sulphite", "sulfite", "sulphur dioxide", "e220", "e221", "e222", "e223", "e224", "e225", "e226", "e227", "e228"],
};

const CROSS_CONTACT_RE = /(may\s+contain|traces?\s+of|produced\s+in|manufactured\s+in|shared\s+(facility|line|equipment)|cross[- ]contact)/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokenFound = (text: string, token: string) =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(token)}([^a-z0-9]|$)`, "i").test(text);

function evidenceAround(text: string, token: string): string {
  const i = text.toLowerCase().indexOf(token.toLowerCase());
  if (i < 0) return token;
  const start = Math.max(0, i - 30);
  const end = Math.min(text.length, i + token.length + 30);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function basicAllergenCheck(input: {
  ingredients: string;
  containsStatement: string;
  allergies: string[];
}): FallbackRisk[] {
  const risks: FallbackRisk[] = [];
  const combined = `${input.ingredients}\n${input.containsStatement}`;
  const lower = combined.toLowerCase();
  const clauses = combined.split(/[.;\n•|]+/);
  const direct = clauses.filter((c) => !CROSS_CONTACT_RE.test(c)).join(" \n ").toLowerCase();
  const cross = clauses.filter((c) => CROSS_CONTACT_RE.test(c)).join(" \n ").toLowerCase();

  const scan = (hay: string, severity: "high" | "medium") => {
    for (const raw of input.allergies) {
      const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (!key) continue;
      const tokens = ALLERGEN_SYNONYMS[key] ?? [key.replace(/_/g, " ")];
      const hit = tokens.find((t) => tokenFound(hay, t));
      if (hit) risks.push({ name: raw, severity, evidence: evidenceAround(hay, hit) });
    }
  };

  scan(direct, "high");
  if (cross) scan(cross, "medium");
  return risks;
}

export function ratingFromRisks(risks: FallbackRisk[], hasNutrition: boolean): "good" | "caution" | "avoid" {
  if (risks.some((r) => r.severity === "high")) return "avoid";
  if (risks.length > 0) return "caution";
  // Unknown product with no data at all → be cautious
  return hasNutrition ? "good" : "caution";
}
