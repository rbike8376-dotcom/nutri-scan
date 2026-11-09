"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGES, translate, type LangCode, type MessageKey } from "@/lib/i18n";

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  locale: string;
  ocrLang: string;
  t: (key: MessageKey) => string;
};

const LangContext = createContext<Ctx | null>(null);
const LANG_KEY = "nutriscan.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as LangCode | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
    } catch { /* private mode — keep default */ }
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  };

  const value = useMemo<Ctx>(() => {
    const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
    return { lang, setLang, locale: meta.locale, ocrLang: meta.ocr, t: (k: MessageKey) => translate(lang, k) };
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
