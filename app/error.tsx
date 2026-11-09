"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="panel p-8">
        <div className="text-5xl" aria-hidden>⚠️</div>
        <h1 className="mt-3 text-3xl font-black text-[var(--text)]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">The app hit an error — your scanned data is safe. Try again, or head home.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className="btn btn-dark min-h-12 px-6">Try again</button>
          <Link href="/" className="btn btn-secondary min-h-12 px-6">← Home</Link>
        </div>
      </div>
    </main>
  );
}
