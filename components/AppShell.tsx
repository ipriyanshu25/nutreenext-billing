"use client";

import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      {!isLogin && <AppHeader />}
      <div className={isLogin ? "app-main app-main-login" : "app-main"}>{children}</div>
    </>
  );
}
