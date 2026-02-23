"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  FileText,
  Download,
  LogOut,
  Menu,
  X,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/summary", label: "Summary", icon: BarChart3 },
  { href: "/statements", label: "Reports", icon: FileText },
];

const currentYear = new Date().getFullYear();
const yearChoices = Array.from({ length: 6 }, (_, i) => currentYear - i);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string>(String(currentYear));
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        if (settings.active_tax_year) {
          setActiveYear(settings.active_tax_year);
        }
        if (settings.company_name) {
          setCompanyName(settings.company_name);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function switchYear(year: string) {
    setActiveYear(year);
    setYearPickerOpen(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_tax_year: year }),
    });
    // Refresh current page to pick up new year
    router.refresh();
  }

  async function handleExport() {
    window.location.href = "/api/export";
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">
          {companyName || "My Sister\u0027s Taxes"}
        </h1>
        <p className="text-xs text-muted-foreground">Bookkeeping Assistant</p>
      </div>

      {/* Year switcher */}
      <div className="p-3 border-b">
        <div className="relative">
          <button
            onClick={() => setYearPickerOpen(!yearPickerOpen)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-muted/60 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tax Year {activeYear}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                yearPickerOpen && "rotate-180"
              )}
            />
          </button>
          {yearPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setYearPickerOpen(false)}
              />
              <div className="absolute left-0 right-0 mt-1 z-20 bg-background border rounded-md shadow-lg py-1">
                {yearChoices.map((y) => {
                  const yearStr = String(y);
                  return (
                    <button
                      key={y}
                      onClick={() => switchYear(yearStr)}
                      className={cn(
                        "w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center justify-between",
                        yearStr === activeYear && "font-semibold bg-accent"
                      )}
                    >
                      {y}
                      {y === currentYear && (
                        <span className="text-[10px] text-muted-foreground">
                          current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 space-y-1 border-t">
        <button
          onClick={handleExport}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between print:hidden">
        <h1 className="text-sm font-semibold">My Sister&apos;s Taxes</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 z-40 h-full w-64 bg-background border-r transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 border-r bg-background print:hidden">
        {navContent}
      </div>
    </>
  );
}
