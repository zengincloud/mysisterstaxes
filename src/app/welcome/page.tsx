"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const yearOptions = [
  currentYear,
  currentYear - 1,
  currentYear - 2,
  currentYear - 3,
];

export default function WelcomePage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup: true,
          name: name.trim(),
          company: company.trim(),
          password,
          year: String(selectedYear),
        }),
      });

      if (res.ok) {
        router.push("/chat");
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-5xl mb-3">📒</div>
          <CardTitle className="text-2xl">
            Welcome to
            <br />
            My Sister&apos;s Taxes
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Your AI bookkeeping assistant for small business in BC.
            <br />
            Let&apos;s get you set up!
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStart} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="owner-name"
                className="text-sm font-medium text-foreground"
              >
                Your name
              </label>
              <Input
                id="owner-name"
                placeholder="e.g. Sarah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="company-name"
                className="text-sm font-medium text-foreground"
              >
                Business / company name
              </label>
              <Input
                id="company-name"
                placeholder="e.g. Sarah's Consulting Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Choose a password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 4 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                What tax year are you starting with?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-center transition-all",
                      selectedYear === year
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-xl font-bold">{year}</span>
                    {year === currentYear && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Current year
                      </p>
                    )}
                    {year === currentYear - 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last year
                      </p>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                You can switch years anytime and add retroactive entries too!
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Setting up..." : "Get Started"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
