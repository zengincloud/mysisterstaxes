"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenPage = pathname === "/login" || pathname === "/welcome";

  if (isFullscreenPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-56 h-screen flex flex-col pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
