"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const currentYear = new Date().getFullYear();
const yearOptions = [
  currentYear,
  currentYear - 1,
  currentYear - 2,
  currentYear - 3,
];

const features = [
  "AI tax deduction suggestor",
  "Simple drag and drop upload",
  "Easy P&L, income statement, and balance sheet generation",
  "Plus easy PDF/CSV printouts for your CPA",
];

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (mode === "signup" && (!password || password.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const body =
        mode === "signup"
          ? {
              signup: true,
              email: email.trim(),
              name: name.trim(),
              company: company.trim(),
              password,
              year: String(selectedYear),
            }
          : { email, password };

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/chat");
      } else {
        const data = await res.json();
        setError(
          data.error ||
            (mode === "login"
              ? "Invalid email or password."
              : "Something went wrong.")
        );
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side — marketing */}
      <div className="lg:w-1/2 bg-zinc-900 text-white p-8 lg:p-16 flex flex-col justify-center">
        <div className="max-w-lg mx-auto lg:mx-0">
          <div className="text-5xl mb-6">📒</div>
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-6">
            My Sister&apos;s Taxes
          </h1>

          <div className="space-y-4 text-zinc-300 text-lg leading-relaxed">
            <p>
              Have back taxes overdue? CRA after your ass? Would you rather jump
              off a building on Nelson St than spend excruciating hours doing
              some mundane shit like this?
            </p>
            <p className="text-white font-semibold text-xl">
              Well this tool is just for you!
            </p>
            <p>
              Sign up today to input your data{" "}
              <span className="text-emerald-400 font-bold">FREE</span> with
              things such as:
            </p>
          </div>

          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-zinc-200">{f}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs text-zinc-500 leading-relaxed">
            *Note: This app does not NETFILE. All remaining ledgers must be run
            by a professional at year end. Discretion is advised.
          </p>
        </div>
      </div>

      {/* Right side — auth form */}
      <div className="lg:w-1/2 bg-gray-50 p-8 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md">
          {/* Tab toggle */}
          <div className="flex rounded-lg bg-gray-200 p-1 mb-8">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-md transition-all",
                mode === "login"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-md transition-all",
                mode === "signup"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-foreground"
                  >
                    Your name
                  </label>
                  <Input
                    id="name"
                    placeholder="e.g. Sarah"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="company"
                    className="text-sm font-medium text-foreground"
                  >
                    Business / company name
                  </label>
                  <Input
                    id="company"
                    placeholder="e.g. Sarah's Consulting Inc."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                {mode === "signup" ? "Choose a password" : "Password"}
              </label>
              <Input
                id="password"
                type="password"
                placeholder={
                  mode === "signup" ? "At least 6 characters" : "Enter password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Starting tax year
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {yearOptions.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        "rounded-lg border-2 py-2 text-center transition-all text-sm font-semibold",
                        selectedYear === year
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-muted hover:border-muted-foreground/30"
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  You can switch years anytime
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading
                ? mode === "signup"
                  ? "Setting up..."
                  : "Signing in..."
                : mode === "signup"
                  ? "Get Started"
                  : "Sign In"}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                    }}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
