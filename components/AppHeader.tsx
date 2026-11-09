"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useAppSettings } from "@/components/SettingsProvider";
import { LANGUAGES } from "@/lib/i18n";
import { useApp } from "@/components/AppProvider";

export default function AppHeader() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useAppSettings();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { authUser, signOut } = useApp();

  useEffect(() => setMounted(true), []);
  if (pathname?.startsWith("/admin")) return null; // admin has its own premium dark console

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center rounded-2xl px-3 py-2 text-sm font-extrabold transition ${
          active ? "bg-[var(--mocha)] text-[var(--gold)] shadow-[var(--shadow-sm)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex min-h-11 items-center gap-2" aria-label="NutriScan AI home">
            <span aria-hidden className="icon-bubble h-10 w-10 text-xl">🥜</span>
            <span className="font-black text-lg tracking-tight text-[var(--text)]">Nutri<span className="text-[var(--gold-strong)]">Scan</span><span className="hidden xs:inline"> AI</span></span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="sr-only" htmlFor="lang-select">Language</label>
          <select
            id="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="input min-h-11 w-auto px-2 text-xs font-extrabold"
            aria-label="Choose language"
          >
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nativeLabel}</option>)}
          </select>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-secondary !min-h-11 !px-3 text-base"
            aria-label={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title="Toggle dark / light mode"
          >
            <span aria-hidden>{mounted ? (theme === "dark" ? "☀️" : "🌙") : "◐"}</span>
            <span className="hidden text-xs sm:inline">{mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme"}</span>
          </button>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {navLink("/onboarding", t("nav.profile"))}
            {settings.features.history && navLink("/history", t("nav.history"))}
          </nav>
          {/* Account cluster — resolves client-side; stable placeholder until mounted */}
          {mounted ? (
            authUser ? (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/onboarding"
                  title={`Signed in as @${authUser.username}`}
                  className="max-w-36 truncate rounded-2xl bg-[var(--mocha)] px-3 py-2 text-xs font-black text-[var(--gold)] shadow-[var(--shadow-sm)]"
                >
                  @{authUser.username}
                </Link>
                <button type="button" onClick={() => void signOut()} className="btn btn-secondary !min-h-11 !px-3 text-[11px]">Sign out</button>
              </div>
            ) : (
              <Link href="/account" className="btn btn-dark !min-h-11 !px-4 text-xs whitespace-nowrap">Sign in</Link>
            )
          ) : (
            <span aria-hidden className="inline-block h-11 w-24 rounded-2xl bg-[var(--surface-2)]" />
          )}
        </div>
      </div>
    </header>
  );
}
