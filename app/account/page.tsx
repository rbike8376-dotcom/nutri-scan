"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type Tab = "signin" | "create";

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return Math.min(4, score);
}
const STRENGTH = ["Too weak", "Weak", "Fair", "Strong", "Excellent"] as const;

export default function AccountPage() {
  const [tab, setTab] = useState<Tab>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = passwordScore(password);
  const strengthLabel = STRENGTH[strength];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const isSignin = tab === "signin";
      const res = await fetch(isSignin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignin
          ? { username: username.trim(), password }
          : { username: username.trim(), password, name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? (isSignin ? "Couldn't sign you in." : "Couldn't create the account."));
        return;
      }
      window.location.assign(data.redirect ?? (data.role === "admin" ? "/admin" : "/"));
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (next: Tab) => { setTab(next); setError(""); };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-10 lg:justify-center">
      <div className="grid min-h-[70vh] grid-cols-1 items-stretch gap-5 lg:min-h-[78vh] lg:grid-cols-[1.05fr_1fr] lg:gap-8">

        {/* Left — brand narrative (desktop), condensed on mobile */}
        <section className="panel-strong sheen relative flex flex-col justify-between overflow-hidden p-6 text-left sm:p-8">
          <div aria-hidden className="glow-orb pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--gold)] opacity-25 blur-3xl" />
          <div aria-hidden className="glow-orb pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-[var(--amber)] opacity-20 blur-3xl" style={{ animationDelay: "-5s" }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span aria-hidden className="icon-bubble h-12 w-12 text-2xl">🥜</span>
              <div className="leading-tight">
                <p className="text-lg font-black tracking-tight text-[#fff8e7]">Nutri<span className="text-[#e7c878]">Scan</span> AI</p>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f4d9a2]/70">Label to health insight</p>
              </div>
            </div>
            <h1 className="mt-6 text-balance text-[clamp(2rem,6vw,3.6rem)] font-black leading-[0.98] tracking-[-0.04em] text-[#fff8e7]">
              One account.<br />
              <span className="headline-gradient">Every label, accounted for.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-[#f4d9a2]/90 sm:text-base">
              Your goals, allergies and doctor&apos;s notes — remembered. Scans and verdicts — saved. Answers spoken in your language.
            </p>
          </div>
          <ul className="relative mt-6 space-y-3 text-sm font-semibold text-[#f4e6d2]/90 sm:mt-10">
            {[
              { icon: "🛡️", text: "Allergy-aware verdicts, matched to your profile — never guesswork" },
              { icon: "🗣️", text: "Verdicts read aloud in EN · हिंदी · ES — shop hands-free" },
              { icon: "🔒", text: "Photos stay on your device; nothing medical is shared without you" },
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-3"><span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/30 text-base">{f.icon}</span>{f.text}</li>
            ))}
          </ul>
        </section>

        {/* Right — the auth form */}
        <section className="panel flex flex-col justify-center p-5 sm:p-7" aria-label="Sign in or create an account">
          <div className="mx-auto flex w-full max-w-md flex-col">
            {/* Tabs */}
            <div role="tablist" aria-label="Sign in or create account" className="grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
              {([
                ["signin", "Sign in"],
                ["create", "Create account"],
              ] as const).map(([key, label]) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchTab(key)}
                    className={`min-h-12 rounded-xl text-sm font-black uppercase tracking-wide transition ${active ? "bg-[var(--panel)] text-[var(--gold-strong)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">{tab === "signin" ? "Welcome back" : "Join NutriScan"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{tab === "signin" ? "Pick up exactly where you left off — your scans and profile." : "30 seconds. Your verdicts start remembering you."}</p>

            <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate={false}>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--text)]">
                Username
                <input
                  type="text"
                  className="input min-h-12"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. alex_gym"
                  minLength={3}
                  maxLength={32}
                  required
                />
              </label>

              {tab === "create" && (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--text)]">
                    Display name <span className="font-medium text-[var(--muted)]">(optional)</span>
                    <input type="text" className="input min-h-12" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoCapitalize="words" placeholder="Alex" maxLength={80} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--text)]">
                    Email <span className="font-medium text-[var(--muted)]">(optional)</span>
                    <input type="email" className="input min-h-12" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" placeholder="you@example.com" maxLength={200} />
                  </label>
                </>
              )}

              <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--text)]">
                Password
                <span className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="input min-h-12 w-full pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={tab === "signin" ? "current-password" : "new-password"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="••••••••••"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </span>
              </label>

              {tab === "create" && password && (
                <div className="-mt-1" aria-hidden>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${strength >= i ? (strength <= 1 ? "bg-red-400" : strength === 2 ? "bg-amber-400" : "bg-emerald-500") : "bg-[var(--surface-2)]"}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--faint)]">{strengthLabel} — 8+ chars with a letter and a number</p>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>
              )}

              <button type="submit" disabled={busy || !username.trim() || !password} className="btn btn-primary min-h-14 w-full text-base">
                {busy ? "Verifying…" : tab === "signin" ? "Sign in" : "Create account"}
              </button>
              <p className="text-center text-[11px] leading-snug text-[var(--faint)]">
                {tab === "signin" ? "No account yet? " : "Already registered? "}
                <button type="button" onClick={() => switchTab(tab === "signin" ? "create" : "signin")} className="font-black text-[var(--gold-strong)] hover:underline">
                  {tab === "signin" ? "Create one — free" : "Sign in instead"}
                </button>
              </p>
            </form>

            <p className="mt-4 text-center text-[10px] leading-snug text-[var(--faint)]">Admin credentials are routed privately to the admin console. Your password is never stored or logged — only a salted hash.</p>
          </div>
        </section>
      </div>
      <p className="mt-4 text-center"><Link href="/" className="text-xs font-bold text-[var(--muted)] hover:text-[var(--gold-strong)]">← Back to scanning</Link></p>
    </main>
  );
}
