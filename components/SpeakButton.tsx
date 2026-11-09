"use client";
import { useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useSpeechSynthesis } from "@/lib/voice";
import { useAppSettings } from "@/components/SettingsProvider";

/** Speak a block of text aloud (e.g. the verdict). Tap again to stop. */
export default function SpeakButton({ text, label, onSpeakingChange }: { text: string; label?: string; onSpeakingChange?: (speaking: boolean) => void }) {
  const { locale, t } = useLanguage();
  const { settings } = useAppSettings();
  const { supported, speaking, speak, stop } = useSpeechSynthesis(locale);
  useEffect(() => { onSpeakingChange?.(speaking); return () => onSpeakingChange?.(false); }, [speaking, onSpeakingChange]);
  if (!settings.features.voice || !supported || !text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--surface-2)]"
    >
      {speaking ? t("result.stop") : (label ?? t("result.listen"))}
    </button>
  );
}
