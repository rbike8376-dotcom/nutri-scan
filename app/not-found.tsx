import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="panel p-8">
        <div className="text-5xl" aria-hidden>🥜</div>
        <h1 className="mt-3 text-3xl font-black text-[var(--text)]">This aisle is empty</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">That page doesn&apos;t exist — but the scanner does.</p>
        <Link href="/" className="btn btn-dark mt-5 min-h-12 px-6">← Back to scanning</Link>
      </div>
    </main>
  );
}
