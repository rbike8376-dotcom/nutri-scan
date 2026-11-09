"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { useSpeechRecognition } from "@/lib/voice";
import { useAppSettings } from "@/components/SettingsProvider";

/** Mic button — push-to-talk dictation into the parent's textarea/input. */
export default function VoiceButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const { locale } = useLanguage();
  const { settings } = useAppSettings();
  const { supported, listening, error, start, stop } = useSpeechRecognition(locale, onText);
  if (!settings.features.voice) return null;

  if (!supported) {
    return (
      <span className={`inline-flex items-center rounded-full border border-[var(--border)] px-3 text-xs text-[var(--muted)] ${className}`} title="Voice input not supported on this browser">
        🎙️ n/a
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Start voice input"}
        title={listening ? "Stop listening" : "Speak"}
        className={`grid h-11 w-11 place-items-center rounded-full border text-lg transition ${
          listening ? "animate-pulse border-red-400 bg-red-50 text-red-700 ring-4 ring-red-200" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--gold-strong)] hover:bg-[var(--surface-2)]"
        }`}
      >
        {listening ? "⏹" : "🎙️"}
      </button>
      {error && <span className="max-w-40 text-[10px] leading-tight text-red-700">{error}</span>}
    </span>
  );
}
