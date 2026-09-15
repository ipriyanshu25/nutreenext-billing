"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PrintControls({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="receipt-controls no-print">
      <button className="btn btn-primary" onClick={() => window.print()}>Print Again</button>
      <Link className="btn btn-primary" href="/billing">Generate Next Bill</Link>
      <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
    </div>
  );
}
