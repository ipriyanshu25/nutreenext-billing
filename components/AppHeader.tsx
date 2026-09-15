"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
    </svg>
  );
}

function ItemsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 9h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2ZM7 7v1h7V7H7Zm0 9v1h7v-1H7Z" />
    </svg>
  );
}

function BillIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12a2 2 0 0 1 2 2v16l-3-1.8L14 21l-2-1.8L10 21l-3-1.8L4 21V5a2 2 0 0 1 2-2Zm2 5h8V6H8v2Zm0 4h8v-2H8v2Zm0 4h5v-2H8v2Z" />
    </svg>
  );
}

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar no-print">
      <Link className="sidebar-brand" href="/dashboard" aria-label="NutreeNext Billing home">
        <span className="sidebar-brand-mark">N</span>
        <span>
          <span className="sidebar-wordmark">NutreeNext</span>
          <span className="sidebar-caption">Billing</span>
        </span>
      </Link>

      <nav className="side-nav" aria-label="Main navigation">
        <Link className={pathname.startsWith("/dashboard") ? "active" : ""} href="/dashboard">
          <span className="side-nav-icon"><DashboardIcon /></span>
          <span>Dashboard</span>
        </Link>

        <Link className={pathname.startsWith("/items") ? "active" : ""} href="/items">
          <span className="side-nav-icon"><ItemsIcon /></span>
          <span>Items</span>
        </Link>

        <Link className={pathname.startsWith("/billing") || pathname.startsWith("/receipt") ? "active" : ""} href="/billing">
          <span className="side-nav-icon"><BillIcon /></span>
          <span>Generate Bill</span>
        </Link>
      </nav>

    </aside>
  );
}
