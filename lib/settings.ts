// Server-only settings store — Sheets-backed, validated, never throws.
import { z } from "zod";
import { readAdminConfig, writeAdminConfig } from "./sheets";
import { DEFAULT_SETTINGS, type AppSettings, type PublicSettings } from "./settings-shared";

export { DEFAULT_SETTINGS } from "./settings-shared";
export type { AppSettings, PublicSettings } from "./settings-shared";

const short = (max: number) => z.string().trim().max(max);

const SettingsSchema = z.object({
  sheetLinkVisible: z.boolean().default(true),
  copy: z.object({
    heroBadge: short(140).default(""),
    heroTitle: short(160).default(""),
    heroSubtitle: short(320).default(""),
  }).default({ heroBadge: "", heroTitle: "", heroSubtitle: "" }),
  features: z.object({
    voice: z.boolean().default(true),
    ask: z.boolean().default(true),
    history: z.boolean().default(true),
  }).default({ voice: true, ask: true, history: true }),
});

function merge(raw: unknown): AppSettings {
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed.data,
    copy: { ...DEFAULT_SETTINGS.copy, ...parsed.data.copy },
    features: { ...DEFAULT_SETTINGS.features, ...parsed.data.features },
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const raw = await readAdminConfig();
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return merge(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Validate + persist. Returns merged settings (defaults filled). Unknown legacy keys (e.g. girl*) are stripped on save. */
export async function saveAppSettings(input: unknown): Promise<{ saved: boolean; settings: AppSettings }> {
  const settings = merge(input);
  const saved = await writeAdminConfig(JSON.stringify(settings));
  return { saved, settings };
}

/** What public clients may see — no admin-only flags. */
export function toPublicSettings(s: AppSettings): PublicSettings {
  return { copy: s.copy, features: s.features };
}
