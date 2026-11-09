"use client";
import { useEffect, useState } from "react";

/** Renders a locale date string only after mount — prevents SSR/client hydration mismatches. */
export default function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    setText(Number.isNaN(d.getTime()) ? iso : d.toLocaleString());
  }, [iso]);
  return <span suppressHydrationWarning>{text || "…"}</span>;
}
