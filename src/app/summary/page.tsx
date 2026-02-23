"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Loader2,
} from "lucide-react";
import { MonthlyChart } from "@/components/monthly-chart";
import { useActiveYear } from "@/lib/use-active-year";

interface SummaryData {
  year: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  gstCollected: number;
  gstPaid: number;
  netGst: number;
  capitalAssets: number;
  transactionCount: number;
  monthly: Array<{
    month: string;
    label: string;
    revenue: number;
    expenses: number;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export default function SummaryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const activeYear = useActiveYear();

  useEffect(() => {
    if (!activeYear) return;

    async function loadSummary() {
      setLoading(true);
      try {
        const res = await fetch(`/api/summary?year=${activeYear}`);
        if (res.ok) {
          const summary = await res.json();
          setData(summary);
        }
      } catch (err) {
        console.error("Failed to load summary:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, [activeYear]);

  if (loading || !activeYear) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load summary data.</p>
      </div>
    );
  }

  const cards = [
    {
      title: "Revenue",
      value: formatCurrency(data.totalRevenue),
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      title: "Expenses",
      value: formatCurrency(data.totalExpenses),
      icon: TrendingDown,
      color: "text-red-500",
    },
    {
      title: "Net Income",
      value: formatCurrency(data.netIncome),
      icon: DollarSign,
      color: data.netIncome >= 0 ? "text-emerald-600" : "text-red-500",
    },
    {
      title: "GST Collected",
      value: formatCurrency(data.gstCollected),
      icon: Receipt,
      color: "text-blue-500",
    },
    {
      title: "GST Paid (ITC)",
      value: formatCurrency(data.gstPaid),
      icon: Receipt,
      color: "text-orange-500",
    },
    {
      title: "Net GST Owing",
      value: formatCurrency(data.netGst),
      icon: Receipt,
      color: data.netGst >= 0 ? "text-amber-600" : "text-emerald-600",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Summary</h1>
        <p className="text-sm text-muted-foreground">
          Tax year {activeYear} &middot; {data.transactionCount} transaction
          {data.transactionCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Estimated Tax Owing - prominent card */}
      {data.netIncome > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">
              Estimated Tax Owing ({activeYear})
            </CardTitle>
            <Receipt className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">
              {formatCurrency(data.netIncome * 0.11 + Math.max(0, data.netGst))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Income tax ({formatCurrency(data.netIncome * 0.11)}) + GST owing (
              {formatCurrency(Math.max(0, data.netGst))}) at BC small business rates (11%)
            </p>
          </CardContent>
        </Card>
      )}

      {data.capitalAssets > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capital Assets Acquired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(data.capitalAssets)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Subject to CCA depreciation - check with your CPA
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={data.monthly} />
        </CardContent>
      </Card>
    </div>
  );
}
