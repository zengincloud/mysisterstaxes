"use client";

import { useState, useEffect, useCallback } from "react";

export function useActiveYear() {
  const [year, setYear] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        setYear(settings.active_tax_year || String(new Date().getFullYear()));
      }
    } catch {
      setYear(String(new Date().getFullYear()));
    }
  }, []);

  useEffect(() => {
    load();

    // Poll every 2 seconds so switching year in sidebar updates other pages
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  return year;
}
