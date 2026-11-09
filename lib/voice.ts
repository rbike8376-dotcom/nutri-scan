"use client";
// Browser-native voice: STT (SpeechRecognition) + TTS (speechSynthesis).
// Free, on-device where supported — audio never leaves the device.
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Push-to-talk dictation. Returns transcript when final, silent on unsupported browsers. */
export function useSpeechRecognition(locale: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const supported = isSpeechRecognitionSupported();

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError("");
    const rec = getRecognition();
    if (!rec) { setError("Voice input is not supported on this browser. Type instead."); return; }
    rec.lang = locale;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const results = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript);
      const final = results.join(" ").trim();
      setInterim(final);
      onFinalRef.current(final);
    };
    rec.onerror = (e) => { setError(e.error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${e.error}`); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError("Microphone is busy — try again."); }
  }, [locale]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  return { supported, listening, interim, error, start, stop, clearError: () => setError("") };
}

/** Read text aloud. Cancels any current utterance first. */
export function useSpeechSynthesis(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const supported = isSpeechSynthesisSupported();
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Chrome/Edge load the voice list asynchronously — preload it so pickVoice() works on first tap
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    synthRef.current = synth;
    const load = () => { try { synth.getVoices(); } catch { /* noop */ } };
    load();
    // Some browsers fire this; harmless elsewhere
    const target = synth as SpeechSynthesis & { addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void; onvoiceschanged?: (() => void) | null };
    if (typeof target.addEventListener === "function") {
      target.addEventListener("voiceschanged", load);
      return () => target.removeEventListener?.("voiceschanged", load);
    }
    target.onvoiceschanged = load;
    return () => { target.onvoiceschanged = null; };
  }, [supported]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!supported) return null;
    const voices = window.speechSynthesis.getVoices();
    const base = locale.split("-")[0].toLowerCase();
    return (
      voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
      null
    );
  }, [locale, supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    const synth = synthRef.current ?? window.speechSynthesis;
    try { if (synth.paused) synth.resume(); } catch { /* noop */ }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 0.98;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  }, [locale, pickVoice, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { supported, speaking, speak, stop };
}
