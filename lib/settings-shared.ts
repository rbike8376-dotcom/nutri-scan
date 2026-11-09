// Client-safe settings contract — no server-only imports allowed in this file.
export type PublicSettings = {
  copy: { heroBadge: string; heroTitle: string; heroSubtitle: string };
  features: { voice: boolean; ask: boolean; history: boolean };
};

export type AppSettings = PublicSettings & { sheetLinkVisible: boolean };

export const DEFAULT_SETTINGS: AppSettings = {
  sheetLinkVisible: true,
  copy: {
    heroBadge: "Informational only — not medical advice",
    heroTitle: "",
    heroSubtitle: "",
  },
  features: { voice: true, ask: true, history: true },
};

export const DEFAULT_PUBLIC: PublicSettings = {
  copy: DEFAULT_SETTINGS.copy,
  features: DEFAULT_SETTINGS.features,
};
