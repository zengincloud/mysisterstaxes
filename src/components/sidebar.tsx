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
  Shield,
  Users,
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

interface AdminUser {
  id: string;
  name: string;
  company: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string>(String(currentYear));
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");

  // Tax estimate
  const [taxEstimate, setTaxEstimate] = useState<number | null>(null);
  const [gstOwing, setGstOwing] = useState<number>(0);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonatingName, setImpersonatingName] = useState("");
  const [adminPickerOpen, setAdminPickerOpen] = useState(false);

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

  const loadTaxEstimate = useCallback(async () => {
    try {
      const res = await fetch("/api/statements?type=tax_estimate");
      if (res.ok) {
        const data = await res.json();
        if (data.taxEstimate) {
          setTaxEstimate(data.taxEstimate.totalTax);
          setGstOwing(data.taxEstimate.gstOwing);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const loadAdminStatus = useCallback(async () => {
    try {
      // Check if current user is admin by trying to access admin endpoint
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setIsAdmin(true);
        const users = await res.json();
        setAdminUsers(users);

        // Check impersonation status
        const impRes = await fetch("/api/admin/impersonate");
        if (impRes.ok) {
          const { impersonating: impId } = await impRes.json();
          if (impId) {
            setImpersonating(impId);
            const target = users.find((u: AdminUser) => u.id === impId);
            setImpersonatingName(
              target ? `${target.name}${target.company ? ` (${target.company})` : ""}` : impId.slice(0, 8)
            );
          }
        }
      }
    } catch {
      // Not admin, ignore
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadTaxEstimate();
    loadAdminStatus();
  }, [loadSettings, loadTaxEstimate, loadAdminStatus]);

  // Reload tax estimate when year changes
  useEffect(() => {
    loadTaxEstimate();
  }, [activeYear, loadTaxEstimate]);

  async function switchYear(year: string) {
    setActiveYear(year);
    setYearPickerOpen(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_tax_year: year }),
    });
    router.refresh();
  }

  async function handleExport() {
    window.location.href = "/api/export";
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  async function handleImpersonate(userId: string) {
    setAdminPickerOpen(false);
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    window.location.reload();
  }

  async function handleStopImpersonating() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.reload();
  }

  const totalOwing = (taxEstimate || 0) + gstOwing;

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Impersonation banner */}
      {impersonating && (
        <div className="bg-amber-500 text-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              <span className="font-medium">Viewing as:</span>
            </div>
            <button
              onClick={handleStopImpersonating}
              className="text-amber-100 hover:text-white underline text-[10px]"
            >
              Stop
            </button>
          </div>
          <p className="font-semibold mt-0.5 truncate">{impersonatingName}</p>
        </div>
      )}

      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">
          {companyName || "My Sister\u0027s Taxes"}
        </h1>
        <p className="text-xs text-muted-foreground">Bookkeeping Assistant</p>
      </div>

      {/* Tax Estimate Widget */}
      <div className="p-3 border-b">
        <div
          className={cn(
            "rounded-lg p-3 text-center",
            totalOwing > 0
              ? "bg-red-50 border border-red-200"
              : "bg-emerald-50 border border-emerald-200"
          )}
        >
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">
            {activeYear} Tax Estimate
          </p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              totalOwing > 0 ? "text-red-600" : "text-emerald-600"
            )}
          >
            ${Math.abs(totalOwing).toLocaleString("en-CA", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p
            className={cn(
              "text-[10px] font-medium mt-0.5",
              totalOwing > 0 ? "text-red-500" : "text-emerald-500"
            )}
          >
            {totalOwing > 0 ? "OWING" : totalOwing < 0 ? "REFUND" : "CLEAR"}
          </p>
        </div>
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

        {/* Admin user picker */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setAdminPickerOpen(!adminPickerOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-amber-600 hover:bg-amber-50 w-full transition-colors"
            >
              <Users className="h-4 w-4" />
              Switch User
            </button>
            {adminPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setAdminPickerOpen(false)}
                />
                <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-background border rounded-md shadow-lg py-1 max-h-48 overflow-y-auto">
                  {impersonating && (
                    <button
                      onClick={handleStopImpersonating}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent text-amber-600 font-medium border-b"
                    >
                      Back to my account
                    </button>
                  )}
                  {adminUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleImpersonate(u.id)}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left hover:bg-accent",
                        impersonating === u.id && "bg-accent font-semibold"
                      )}
                    >
                      <span className="block">{u.name}</span>
                      {u.company && (
                        <span className="block text-[10px] text-muted-foreground">
                          {u.company}
                        </span>
                      )}
                    </button>
                  ))}
                  {adminUsers.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No users yet
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

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
