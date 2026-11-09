"use client";
// Consumer-facing settings from /api/settings (admin-controlled).
// Server and first client render both use DEFAULT_SETTINGS to avoid hydration diffs;
// fetched values apply after mount.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PUBLIC, type PublicSettings } from "@/lib/settings-shared";

type Ctx = { settings: PublicSettings; refresh: () => void };
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC);

  const refresh = () => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : DEFAULT_PUBLIC))
      .then((data) => setSettings({ ...DEFAULT_PUBLIC, ...data, copy: { ...DEFAULT_PUBLIC.copy, ...(data?.copy ?? {}) }, features: { ...DEFAULT_PUBLIC.features, ...(data?.features ?? {}) } }))
      .catch(() => { /* keep defaults */ });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const value = useMemo(() => ({ settings, refresh }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used inside <SettingsProvider>");
  return ctx;
}
