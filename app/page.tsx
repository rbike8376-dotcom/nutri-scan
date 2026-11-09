"use client";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { useAppSettings } from "@/components/SettingsProvider";
import { ALL_DISCLAIMERS } from "@/lib/disclaimers";

const PREVIEW = {
  en: {
    sample: "Sample verdict",
    matched: "Matched to your gym goal & allergies",
    fit: "Good fit",
    macro: "12 g protein · 4 g sugar / 100 g",
    b1: "Protein-forward — fits your muscle-gain goal",
    b2: "No milk, nuts or soy listed — matches your allergy profile",
    b3: "Always verify “may contain…” on the physical pack",
    speak: "Verdicts are read aloud, in your language",
    caption: "Goals · Allergies · Doctor notes · Avoid-list",
  },
  hi: {
    sample: "नमूना फ़ैसला",
    matched: "आपके जिम गोल और एलर्जी से मिलान",
    fit: "अच्छी फिट",
    macro: "12 g प्रोटीन · 4 g चीनी / 100 g",
    b1: "प्रोटीन-भरपूर — मसल्स-गेन गोल के अनुरूप",
    b2: "दूध, मेवे या सोया दर्ज नहीं — आपकी एलर्जी प्रोफ़ाइल से मेल",
    b3: "“हो सकता है इसमें…” वाली पंक्ति पैक पर ज़रूर जाँचें",
    speak: "फ़ैसला आपकी भाषा में सुनाया जाता है",
    caption: "गोल · एलर्जी · दवाई-सलाह · बचाव सूची",
  },
  es: {
    sample: "Resultado de ejemplo",
    matched: "Ajustado a tu meta de gym y alergias",
    fit: "Buena opción",
    macro: "12 g proteína · 4 g azúcar / 100 g",
    b1: "Alto en proteína — encaja con tu meta muscular",
    b2: "Sin leche, frutos secos ni soja — coincide con tus alergias",
    b3: "Verifica siempre “puede contener…” en el envase físico",
    speak: "El veredicto se lee en voz alta, en tu idioma",
    caption: "Metas · Alergias · Notas del doctor · Lista de evitar",
  },
} as const;

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { settings } = useAppSettings();

  const badgeText = settings.copy.heroBadge.trim() || t("home.badge");
  const titleOverride = settings.copy.heroTitle.trim();
  const subtitleText = settings.copy.heroSubtitle.trim() || t("home.subtitle");
  const p = lang === "hi" ? PREVIEW.hi : lang === "es" ? PREVIEW.es : PREVIEW.en;

  const pillars = [
    { icon: "🎯", title: lang === "hi" ? "आपके लिए ही" : lang === "es" ? "Hecho para ti" : "Built around you", text: lang === "hi" ? "गोल, एलर्जी, दवा-सलाह और बचाव सूची — सब एक साथ" : lang === "es" ? "Objetivos, alergias, médico y preferencias en una sola lectura" : "Your goals, allergies, doctor’s notes and avoid-list in every verdict" },
    { icon: "🔊", title: lang === "hi" ? "आवाज़ में जवाब" : lang === "es" ? "Veredicto hablado" : "Spoken verdicts", text: lang === "hi" ? "नतीजा सुनकर समझिए — हर उम्र के लिए" : lang === "es" ? "Escucha el resultado — útil para todas las edades" : "Hear the answer read aloud — perfect for seniors and shopping trips" },
    { icon: "🛒", title: lang === "hi" ? "क्या खरीदें?" : lang === "es" ? "Qué conviene comprar" : "Know what to buy", text: lang === "hi" ? "बेहतर विकल्प और खरीद/छोड़ सलाह" : lang === "es" ? "Alternativas y consejo claro de comprar o saltar" : "Clear buy-or-skip guidance and smarter shelf alternatives" },
  ];

  const floating = [
    { e: "🥜", cls: "left-[4%] top-28 float-1 text-4xl sm:text-6xl" },
    { e: "🥛", cls: "right-[5%] top-20 float-2 text-3xl sm:text-5xl" },
    { e: "🌾", cls: "left-[7%] bottom-52 float-3 text-3xl sm:text-5xl" },
    { e: "🍫", cls: "right-[9%] bottom-64 float-1 text-3xl sm:text-5xl" },
    { e: "🌯", cls: "left-[45%] top-8 float-2 text-2xl sm:text-4xl hidden sm:block" },
    { e: "🥚", cls: "right-[32%] top-16 float-3 text-2xl sm:text-4xl hidden md:block" },
  ];

  const howItWorks = [
    { icon: "📷", title: t("home.step1"), text: t("home.step1d") },
    { icon: "✅", title: t("home.step2"), text: t("home.step2d") },
    { icon: "⚡", title: t("home.step3"), text: t("home.step3d") },
  ];

  return (
    <main className="relative isolate flex flex-col overflow-hidden">
      {/* Ambient 3D food field */}
      <div aria-hidden className="glow-orb pointer-events-none absolute left-[-8rem] top-48 -z-10 h-96 w-96 rounded-full bg-[color-mix(in_srgb,var(--amber)_20%,transparent)] blur-3xl" />
      <div aria-hidden className="glow-orb pointer-events-none absolute right-[-9rem] top-10 -z-10 h-[28rem] w-[28rem] rounded-full bg-[color-mix(in_srgb,var(--gold)_25%,transparent)] blur-3xl" style={{ animationDelay: "-4s" }} />
      {floating.map((f, i) => <span key={i} aria-hidden className={`pointer-events-none absolute select-none opacity-80 drop-shadow-xl ${f.cls}`}>{f.e}</span>)}

      {/* Hero — narrative left, professional sample-verdict preview right */}
      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 pb-7 pt-6 text-center sm:pt-12 lg:grid-cols-[1.12fr_1fr] lg:gap-10 lg:text-left">
        <div>
          <div className="rise"><span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-[11px] sm:text-xs font-black text-[var(--amber-deep)] shadow-[var(--shadow-sm)]">⚠️ {badgeText}</span></div>

          {titleOverride ? (
            <h1 className="rise delay-1 mx-auto mt-6 max-w-5xl text-balance text-[clamp(2.4rem,10.5vw,5.4rem)] font-black leading-[0.95] tracking-[-0.05em] text-[var(--text)] lg:mx-0"><span className="headline-gradient" style={{ whiteSpace: "pre-line" }}>{titleOverride}</span></h1>
          ) : (
            <h1 className="rise delay-1 mx-auto mt-6 max-w-5xl text-balance text-[clamp(2.9rem,12.5vw,6.4rem)] font-black leading-[0.94] tracking-[-0.06em] text-[var(--text)] lg:mx-0">
              {t("home.titleA")}<br />
              <span className="headline-gradient">{t("home.titleB")}</span><br />{t("home.titleC")}
            </h1>
          )}

          <p className="rise delay-2 mx-auto mt-5 max-w-2xl text-pretty text-base sm:text-xl font-semibold leading-snug text-[var(--muted)] lg:mx-0">{subtitleText}</p>

          <div className="rise delay-3 mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs font-black text-[var(--mocha)] lg:justify-start">
            {["🆓 100% free", "📴 Private OCR", "🗣️ Voice in & out", "🌍 EN · हिंदी · ES", "🧠 Goal-aware AI"].map((pill) => <span key={pill} className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-sm">{pill}</span>)}
          </div>
        </div>

        {/* Professional product preview — what a verified verdict looks like */}
        <div className="rise delay-2 flex flex-col items-center gap-3">
          <figure className="panel-strong sheen w-full max-w-md p-5 text-left" aria-label="Sample verdict preview">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e7c878]">{p.sample}</p>
              <span className="rounded-full border border-[#e7c878]/30 bg-black/30 px-3 py-1 text-[10px] font-bold text-[#f4d9a2]">Barcode · Open Food Facts</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e7c878]/15 text-3xl" aria-hidden>🍫</div>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-[#fff8e7]">Cocoa Protein Bar · 60 g</p>
                <p className="text-[11px] leading-snug text-[#cfb39e]">{p.matched}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-300/30">{p.fit}</span>
              <span className="rounded-full border border-[#e7c878]/25 px-3 py-1 text-[10px] font-bold text-[#f4d9a2]">{p.macro}</span>
            </div>

            <ul className="mt-3 space-y-1.5 text-xs leading-snug text-[#f4e6d2]/85">
              {[p.b1, p.b2, p.b3].map((line, i) => (
                <li key={i} className="flex items-start gap-2"><span className="mt-0.5 text-[#e7c878]">✓</span>{line}</li>
              ))}
            </ul>

            <figcaption className="mt-3 flex items-center justify-between gap-2 border-t border-[#e7c878]/15 pt-3">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#cfb39e]"><span aria-hidden>🔊</span>{p.speak}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#e7c878]">EN · हिंदी · ES</span>
            </figcaption>
          </figure>

          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--faint)]">{p.caption}</p>
        </div>
      </section>

      {/* Input cards — tactile 3D */}
      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:gap-6" aria-label="Choose input method">
        <Link href="/scan/barcode" className="panel-strong sheen card-3d group flex min-h-60 cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center no-underline">
          <span aria-hidden className="relative z-10 text-7xl drop-shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">🔍</span>
          <span className="relative z-10 text-3xl font-black tracking-tight text-[#fff8e7]">{t("home.scanBarcode")}</span>
          <span className="relative z-10 max-w-[30ch] text-sm font-medium leading-snug text-[#f4d9a2]/90">{t("home.scanBarcodeSub")}</span>
          <span className="relative z-10 rounded-full bg-[var(--gold)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2a1608]">Open Food Facts</span>
        </Link>

        <Link href="/scan/photo" className="panel card-3d group flex min-h-60 cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center no-underline">
          <span aria-hidden className="icon-bubble h-20 w-20 text-4xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">📸</span>
          <span className="text-3xl font-black tracking-tight text-[var(--text)]">{t("home.scanPhoto")}</span>
          <span className="max-w-[30ch] text-sm font-medium leading-snug text-[var(--muted)]">{t("home.scanPhotoSub")}</span>
          <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--gold-strong)]">On-device OCR</span>
        </Link>
      </section>

      {/* Pillars */}
      <section className="relative mx-auto mt-5 grid w-full max-w-6xl grid-cols-1 gap-3 px-4 sm:grid-cols-3" aria-label="Why people use it">
        {pillars.map((c, i) => (
          <div key={i} className="panel-soft flex items-start gap-3 p-4 transition-transform duration-300 hover:-translate-y-1">
            <span aria-hidden className="text-3xl drop-shadow">{c.icon}</span>
            <span><strong className="block text-base text-[var(--text)]">{c.title}</strong><span className="mt-0.5 block text-xs sm:text-sm leading-snug text-[var(--muted)]">{c.text}</span></span>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="relative mx-auto mt-7 w-full max-w-6xl px-4" aria-label="How it works">
        <p className="kicker text-center">{t("home.howTitle")}</p>
        <ol className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {howItWorks.map((s, i) => (
            <li key={i} className="panel flex items-center gap-4 p-4">
              <div className="relative">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--mocha)] text-2xl shadow-[var(--shadow-sm)]" aria-hidden>{s.icon}</span>
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--gold)] text-[10px] font-black text-[#2a1608]">{i + 1}</span>
              </div>
              <span><strong className="block text-lg text-[var(--text)]">{s.title}</strong><span className="mt-0.5 block text-xs sm:text-sm leading-snug text-[var(--muted)]">{s.text}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* Disclaimers */}
      <section className="relative mx-auto mb-8 mt-6 w-full max-w-6xl px-4" aria-label="Medical disclaimer">
        <div className="callout p-4 text-[11px] sm:text-xs shadow-sm">
          <strong className="mb-1 block text-sm text-[var(--amber-deep)]">⚠️ {t("home.disclaimerTitle")}</strong>
          <ul className="list-disc space-y-1 pl-5">
            {ALL_DISCLAIMERS.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_65%,transparent)] py-4 text-center text-[11px] text-[var(--faint)] backdrop-blur px-4">
        <span>NutriScan AI · Packaged-food information only · Not a medical device · Food data © Open Food Facts contributors (ODbL)</span>
      </footer>
    </main>
  );
}
