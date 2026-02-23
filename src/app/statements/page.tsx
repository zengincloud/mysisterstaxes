"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Printer,
  ChevronDown,
  AlertTriangle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LineItem {
  name: string;
  amount: number;
}

interface StatementsData {
  year: string;
  availableYears: string[];
  transactionCount: number;
  pnl: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: LineItem[];
    ccaDepreciation: number;
    totalExpenses: number;
    netIncomeBeforeTax: number;
    estimatedTax: number;
    netIncomeAfterTax: number;
  };
  balanceSheet: {
    assets: {
      current: LineItem[];
      longTerm: LineItem[];
      totalAssets: number;
    };
    liabilities: {
      current: LineItem[];
      totalLiabilities: number;
    };
    equity: {
      retainedEarnings: number;
    };
  };
  cashFlow: {
    operating: {
      netIncome: number;
      addBack: LineItem[];
      changes: LineItem[];
      totalOperating: number;
    };
    investing: {
      items: LineItem[];
      totalInvesting: number;
    };
    financing: {
      items: LineItem[];
      totalFinancing: number;
    };
    netChange: number;
  };
  taxEstimate: {
    netIncomeBeforeTax: number;
    federalRate: number;
    bcRate: number;
    federalTax: number;
    bcTax: number;
    totalTax: number;
    gstOwing: number;
    totalOwing: number;
  };
}

type Tab = "pnl" | "balance_sheet" | "cash_flow" | "tax_estimate";

const tabs: { key: Tab; label: string }[] = [
  { key: "pnl", label: "Profit & Loss" },
  { key: "balance_sheet", label: "Balance Sheet" },
  { key: "cash_flow", label: "Cash Flow" },
  { key: "tax_estimate", label: "Tax Estimate" },
];

function fmt(amount: number) {
  const formatted = Math.abs(amount).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `($${formatted})` : `$${formatted}`;
}

function StatementLine({
  label,
  amount,
  bold,
  indent,
  border,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between py-1.5 px-2",
        bold && "font-semibold",
        indent && "pl-8",
        border && "border-t border-foreground/20 mt-1 pt-2"
      )}
    >
      <span className={cn("text-sm", indent && "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-mono tabular-nums",
          amount < 0 && "text-red-500"
        )}
      >
        {fmt(amount)}
      </span>
    </div>
  );
}

export default function StatementsPage() {
  const [data, setData] = useState<StatementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("pnl");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [yearOpen, setYearOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const loadData = useCallback(async (year: string) => {
    setLoading(true);
    try {
      const [statementsRes, settingsRes] = await Promise.all([
        fetch(`/api/statements?year=${year}`),
        fetch("/api/settings"),
      ]);
      if (statementsRes.ok) {
        const result = await statementsRes.json();
        setData(result);
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.company_name) setCompanyName(settings.company_name);
      }
    } catch (err) {
      console.error("Failed to load statements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedYear);
  }, [selectedYear, loadData]);

  function handlePrint() {
    window.print();
  }

  function handleExportCSV() {
    if (!data) return;
    const tab = activeTab;
    let csvContent = "";

    if (tab === "pnl") {
      csvContent = "Profit & Loss Statement," + selectedYear + "\n\n";
      csvContent += "Category,Amount\n";
      csvContent += `Revenue,${data.pnl.revenue.toFixed(2)}\n`;
      csvContent += `Cost of Goods Sold,${(-data.pnl.cogs).toFixed(2)}\n`;
      csvContent += `Gross Profit,${data.pnl.grossProfit.toFixed(2)}\n`;
      csvContent += "\nOperating Expenses\n";
      for (const exp of data.pnl.expenses) {
        csvContent += `${exp.name},${exp.amount.toFixed(2)}\n`;
      }
      if (data.pnl.ccaDepreciation > 0) {
        csvContent += `CCA / Depreciation,${data.pnl.ccaDepreciation.toFixed(2)}\n`;
      }
      csvContent += `Total Operating Expenses,${data.pnl.totalExpenses.toFixed(2)}\n`;
      csvContent += `\nNet Income Before Tax,${data.pnl.netIncomeBeforeTax.toFixed(2)}\n`;
      csvContent += `Estimated Tax,${data.pnl.estimatedTax.toFixed(2)}\n`;
      csvContent += `Net Income After Tax,${data.pnl.netIncomeAfterTax.toFixed(2)}\n`;
    } else if (tab === "balance_sheet") {
      csvContent = "Balance Sheet," + selectedYear + "\n\n";
      csvContent += "Assets\n";
      csvContent += "Account,Amount\n";
      for (const item of data.balanceSheet.assets.current) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      for (const item of data.balanceSheet.assets.longTerm) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      csvContent += `Total Assets,${data.balanceSheet.assets.totalAssets.toFixed(2)}\n\n`;
      csvContent += "Liabilities\n";
      for (const item of data.balanceSheet.liabilities.current) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      csvContent += `Total Liabilities,${data.balanceSheet.liabilities.totalLiabilities.toFixed(2)}\n\n`;
      csvContent += "Equity\n";
      csvContent += `Retained Earnings,${data.balanceSheet.equity.retainedEarnings.toFixed(2)}\n`;
    } else if (tab === "cash_flow") {
      csvContent = "Cash Flow Statement," + selectedYear + "\n\n";
      csvContent += "Operating Activities\n";
      csvContent += `Net Income,${data.cashFlow.operating.netIncome.toFixed(2)}\n`;
      for (const item of data.cashFlow.operating.addBack) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      for (const item of data.cashFlow.operating.changes) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      csvContent += `Net Cash from Operations,${data.cashFlow.operating.totalOperating.toFixed(2)}\n\n`;
      csvContent += "Investing Activities\n";
      for (const item of data.cashFlow.investing.items) {
        csvContent += `${item.name},${item.amount.toFixed(2)}\n`;
      }
      csvContent += `Net Cash from Investing,${data.cashFlow.investing.totalInvesting.toFixed(2)}\n\n`;
      csvContent += `Net Change in Cash,${data.cashFlow.netChange.toFixed(2)}\n`;
    } else if (tab === "tax_estimate") {
      csvContent = "Tax Estimate," + selectedYear + "\n\n";
      csvContent += `Net Income Before Tax,${data.taxEstimate.netIncomeBeforeTax.toFixed(2)}\n`;
      csvContent += `Federal Tax (9%),${data.taxEstimate.federalTax.toFixed(2)}\n`;
      csvContent += `BC Tax (2%),${data.taxEstimate.bcTax.toFixed(2)}\n`;
      csvContent += `Total Income Tax,${data.taxEstimate.totalTax.toFixed(2)}\n`;
      csvContent += `GST Owing,${data.taxEstimate.gstOwing.toFixed(2)}\n`;
      csvContent += `Total Owing,${data.taxEstimate.totalOwing.toFixed(2)}\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load statement data.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Financial Statements</h1>
          <p className="text-sm text-muted-foreground">
            {companyName && <>{companyName} &middot; </>}
            {data.transactionCount} transactions in {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setYearOpen(!yearOpen)}
              className="gap-2"
            >
              {selectedYear}
              <ChevronDown className="h-4 w-4" />
            </Button>
            {yearOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setYearOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-20 bg-background border rounded-md shadow-lg py-1 min-w-[120px]">
                  {data.availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setYearOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-sm text-left hover:bg-accent",
                        year === selectedYear && "font-semibold bg-accent"
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-xl font-bold">
          {companyName || "My Sister\u0027s Taxes"}
        </h1>
        <p className="text-sm text-gray-500">
          {tabs.find((t) => t.key === activeTab)?.label} - Year ending December
          31, {selectedYear}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b print:hidden overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "pnl" && <ProfitAndLoss pnl={data.pnl} year={selectedYear} />}
      {activeTab === "balance_sheet" && (
        <BalanceSheetView bs={data.balanceSheet} year={selectedYear} />
      )}
      {activeTab === "cash_flow" && (
        <CashFlowView cf={data.cashFlow} year={selectedYear} />
      )}
      {activeTab === "tax_estimate" && (
        <TaxEstimateView tax={data.taxEstimate} year={selectedYear} />
      )}
    </div>
  );
}

function ProfitAndLoss({
  pnl,
  year,
}: {
  pnl: StatementsData["pnl"];
  year: string;
}) {
  return (
    <Card className="print:border-none print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle>Profit & Loss Statement</CardTitle>
        <p className="text-sm text-muted-foreground">
          For the year ending December 31, {year}
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        <StatementLine label="Revenue" amount={pnl.revenue} bold />
        <StatementLine label="Cost of Goods Sold" amount={-pnl.cogs} indent />
        <StatementLine
          label="Gross Profit"
          amount={pnl.grossProfit}
          bold
          border
        />

        <div className="pt-2">
          <p className="text-sm font-semibold px-2 py-1">
            Operating Expenses
          </p>
          {pnl.expenses.map((exp) => (
            <StatementLine
              key={exp.name}
              label={exp.name}
              amount={exp.amount}
              indent
            />
          ))}
          {pnl.ccaDepreciation > 0 && (
            <StatementLine
              label="CCA / Depreciation"
              amount={pnl.ccaDepreciation}
              indent
            />
          )}
          <StatementLine
            label="Total Operating Expenses"
            amount={pnl.totalExpenses}
            bold
            border
          />
        </div>

        <StatementLine
          label="Net Income Before Tax"
          amount={pnl.netIncomeBeforeTax}
          bold
          border
        />
        <StatementLine
          label="Estimated Income Tax (11%)"
          amount={-pnl.estimatedTax}
          indent
        />
        <StatementLine
          label="Net Income After Tax"
          amount={pnl.netIncomeAfterTax}
          bold
          border
        />
      </CardContent>
    </Card>
  );
}

function BalanceSheetView({
  bs,
  year,
}: {
  bs: StatementsData["balanceSheet"];
  year: string;
}) {
  return (
    <Card className="print:border-none print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle>Balance Sheet</CardTitle>
        <p className="text-sm text-muted-foreground">
          As at December 31, {year}
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-semibold px-2 py-1">Assets</p>
        <p className="text-xs text-muted-foreground px-2">Current Assets</p>
        {bs.assets.current.map((item) => (
          <StatementLine
            key={item.name}
            label={item.name}
            amount={item.amount}
            indent
          />
        ))}
        {bs.assets.longTerm.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground px-2 pt-2">
              Long-Term Assets
            </p>
            {bs.assets.longTerm.map((item) => (
              <StatementLine
                key={item.name}
                label={item.name}
                amount={item.amount}
                indent
              />
            ))}
          </>
        )}
        <StatementLine
          label="Total Assets"
          amount={bs.assets.totalAssets}
          bold
          border
        />

        <div className="pt-3">
          <p className="text-sm font-semibold px-2 py-1">Liabilities</p>
          {bs.liabilities.current.map((item) => (
            <StatementLine
              key={item.name}
              label={item.name}
              amount={item.amount}
              indent
            />
          ))}
          <StatementLine
            label="Total Liabilities"
            amount={bs.liabilities.totalLiabilities}
            bold
            border
          />
        </div>

        <div className="pt-3">
          <p className="text-sm font-semibold px-2 py-1">
            Shareholder&apos;s Equity
          </p>
          <StatementLine
            label="Retained Earnings"
            amount={bs.equity.retainedEarnings}
            indent
          />
          <StatementLine
            label="Total Equity"
            amount={bs.equity.retainedEarnings}
            bold
            border
          />
        </div>

        <StatementLine
          label="Total Liabilities + Equity"
          amount={
            bs.liabilities.totalLiabilities + bs.equity.retainedEarnings
          }
          bold
          border
        />
      </CardContent>
    </Card>
  );
}

function CashFlowView({
  cf,
  year,
}: {
  cf: StatementsData["cashFlow"];
  year: string;
}) {
  return (
    <Card className="print:border-none print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle>Cash Flow Statement</CardTitle>
        <p className="text-sm text-muted-foreground">
          For the year ending December 31, {year}
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-semibold px-2 py-1">
          Operating Activities
        </p>
        <StatementLine
          label="Net Income"
          amount={cf.operating.netIncome}
          indent
        />
        {cf.operating.addBack.map((item) => (
          <StatementLine
            key={item.name}
            label={`Add back: ${item.name}`}
            amount={item.amount}
            indent
          />
        ))}
        {cf.operating.changes.map((item) => (
          <StatementLine
            key={item.name}
            label={item.name}
            amount={item.amount}
            indent
          />
        ))}
        <StatementLine
          label="Net Cash from Operations"
          amount={cf.operating.totalOperating}
          bold
          border
        />

        <div className="pt-3">
          <p className="text-sm font-semibold px-2 py-1">
            Investing Activities
          </p>
          {cf.investing.items.map((item) => (
            <StatementLine
              key={item.name}
              label={item.name}
              amount={item.amount}
              indent
            />
          ))}
          <StatementLine
            label="Net Cash from Investing"
            amount={cf.investing.totalInvesting}
            bold
            border
          />
        </div>

        {cf.financing.items.length > 0 && (
          <div className="pt-3">
            <p className="text-sm font-semibold px-2 py-1">
              Financing Activities
            </p>
            {cf.financing.items.map((item) => (
              <StatementLine
                key={item.name}
                label={item.name}
                amount={item.amount}
                indent
              />
            ))}
            <StatementLine
              label="Net Cash from Financing"
              amount={cf.financing.totalFinancing}
              bold
              border
            />
          </div>
        )}

        <StatementLine
          label="Net Change in Cash"
          amount={cf.netChange}
          bold
          border
        />
      </CardContent>
    </Card>
  );
}

function TaxEstimateView({
  tax,
  year,
}: {
  tax: StatementsData["taxEstimate"];
  year: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="print:border-none print:shadow-none">
        <CardHeader className="print:hidden">
          <CardTitle>Estimated Tax Owing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tax year {year} (BC small business rates)
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          <StatementLine
            label="Net Income Before Tax"
            amount={tax.netIncomeBeforeTax}
            bold
          />

          <div className="pt-2">
            <p className="text-sm font-semibold px-2 py-1">Income Tax</p>
            <StatementLine
              label={`Federal (${(tax.federalRate * 100).toFixed(0)}% small business rate)`}
              amount={tax.federalTax}
              indent
            />
            <StatementLine
              label={`BC Provincial (${(tax.bcRate * 100).toFixed(0)}% small business rate)`}
              amount={tax.bcTax}
              indent
            />
            <StatementLine
              label="Total Income Tax"
              amount={tax.totalTax}
              bold
              border
            />
          </div>

          <div className="pt-2">
            <p className="text-sm font-semibold px-2 py-1">GST</p>
            <StatementLine
              label="Net GST Owing"
              amount={tax.gstOwing}
              indent
            />
          </div>

          <StatementLine
            label="Total Estimated Tax + GST Owing"
            amount={tax.totalOwing}
            bold
            border
          />
        </CardContent>
      </Card>

      {/* Tax tip card */}
      <Card className="border-amber-200 bg-amber-50 print:hidden">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-800">
                Want to reduce your tax bill?
              </p>
              <p className="text-sm text-amber-700">
                Ask me in the chat! Try: &quot;How can I reduce my taxes this
                year?&quot; and I&apos;ll suggest strategies based on your actual
                numbers.
              </p>
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                These are estimates only - confirm with your CPA
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
