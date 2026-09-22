"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PrintControls({ autoPrint, billId }: { autoPrint: boolean; billId: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="receipt-controls no-print">
      <button className="btn btn-primary" onClick={() => window.print()}>Print Again</button>
      <Link className="btn btn-ghost" href={`/bills/${billId}/edit`}>Edit Bill</Link>
      <Link className="btn btn-ghost" href="/bills">All Bills</Link>
      <Link className="btn btn-primary" href="/billing">Generate Next Bill</Link>
      <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
    </div>
  );
}
