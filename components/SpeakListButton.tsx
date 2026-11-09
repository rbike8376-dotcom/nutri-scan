"use client";
import { useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useSpeechSynthesis } from "@/lib/voice";
import { useAppSettings } from "@/components/SettingsProvider";

/** Read a list of items aloud, one item at a time, with numbers. Tap again to stop. */
export default function SpeakListButton({ items, label = "🔊", onSpeakingChange }: { items: string[]; label?: string; onSpeakingChange?: (speaking: boolean) => void }) {
  const { locale } = useLanguage();
  const { settings } = useAppSettings();
  const { supported, speaking, speak, stop } = useSpeechSynthesis(locale);
  useEffect(() => { onSpeakingChange?.(speaking); return () => onSpeakingChange?.(false); }, [speaking, onSpeakingChange]);
  if (!settings.features.voice || !supported || items.length === 0) return null;
  const text = items.map((item, i) => `${i + 1}. ${item}`).join(". ");
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-pressed={speaking}
      title={speaking ? "Stop reading" : "Read list aloud"}
      className="inline-flex h-9 min-w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-xs font-black text-[var(--text)] transition hover:border-[var(--gold)]"
    >
      {speaking ? "⏹" : label}
    </button>
  );
}
