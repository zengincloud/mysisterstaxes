"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface PnLExpense {
  name: string;
  amount: number;
}

interface StatementsData {
  year: string;
  transactionCount: number;
  pnl: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: PnLExpense[];
    ccaDepreciation: number;
    totalExpenses: number;
    netIncomeBeforeTax: number;
    estimatedTax: number;
    netIncomeAfterTax: number;
  };
  taxEstimate: {
    netIncomeBeforeTax: number;
    federalTax: number;
    bcTax: number;
    totalTax: number;
    gstOwing: number;
    totalOwing: number;
  };
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  accountDebit: string;
  accountCredit: string;
  gstAmount: number;
  flaggedForReview: boolean;
}

const CAD = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

const categoryLabel: Record<string, string> = {
  revenue: "Revenue",
  cogs: "COGS",
  operating_expense: "Expense",
  capital_asset: "Capital Asset",
};

function PrintContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const company = searchParams.get("company") || "My Sister's Taxes";

  const [statements, setStatements] = useState<StatementsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [stmtRes, txRes] = await Promise.all([
        fetch(`/api/statements?year=${year}&type=all`),
        fetch(`/api/transactions?year=${year}`),
      ]);
      if (stmtRes.ok) setStatements(await stmtRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && statements) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, statements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">Preparing your financial statements…</span>
      </div>
    );
  }

  if (!statements) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Failed to load data.</p>
      </div>
    );
  }

  const { pnl, taxEstimate } = statements;
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-doc">
      {/* Header */}
      <div className="print-header">
        <h1>{company}</h1>
        <p className="print-subtitle">Financial Statements — Tax Year {year}</p>
        <p className="print-meta">Generated {today} &nbsp;·&nbsp; {statements.transactionCount} transactions</p>
      </div>

      {/* Income Statement */}
      <section className="print-section">
        <h2>Income Statement (Profit & Loss)</h2>
        <table className="print-table">
          <tbody>
            <tr className="section-header">
              <td>Revenue</td>
              <td></td>
            </tr>
            <tr>
              <td className="indent">Gross Revenue</td>
              <td className="amount">{CAD(pnl.revenue)}</td>
            </tr>
            <tr className="subtotal">
              <td>Cost of Goods Sold</td>
              <td className="amount">({CAD(pnl.cogs)})</td>
            </tr>
            <tr className="total-row">
              <td>Gross Profit</td>
              <td className="amount">{CAD(pnl.grossProfit)}</td>
            </tr>

            <tr className="spacer"><td colSpan={2}></td></tr>

            <tr className="section-header">
              <td>Operating Expenses</td>
              <td></td>
            </tr>
            {pnl.expenses.map((e) => (
              <tr key={e.name}>
                <td className="indent">{e.name}</td>
                <td className="amount">{CAD(e.amount)}</td>
              </tr>
            ))}
            {pnl.ccaDepreciation > 0 && (
              <tr>
                <td className="indent">CCA Depreciation</td>
                <td className="amount">{CAD(pnl.ccaDepreciation)}</td>
              </tr>
            )}
            <tr className="subtotal">
              <td>Total Operating Expenses</td>
              <td className="amount">({CAD(pnl.totalExpenses)})</td>
            </tr>

            <tr className="spacer"><td colSpan={2}></td></tr>

            <tr className="total-row grand-total">
              <td>Net Income Before Tax</td>
              <td className="amount">{CAD(pnl.netIncomeBeforeTax)}</td>
            </tr>
            <tr>
              <td className="indent">Estimated Income Tax (11%)</td>
              <td className="amount">({CAD(pnl.estimatedTax)})</td>
            </tr>
            <tr className="total-row grand-total highlight">
              <td>Net Income After Tax</td>
              <td className="amount">{CAD(pnl.netIncomeAfterTax)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* GST Summary */}
      <section className="print-section">
        <h2>GST Summary</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td>Federal Tax (9%)</td>
              <td className="amount">{CAD(taxEstimate.federalTax)}</td>
            </tr>
            <tr>
              <td>BC Provincial Tax (2%)</td>
              <td className="amount">{CAD(taxEstimate.bcTax)}</td>
            </tr>
            <tr className="subtotal">
              <td>Estimated Income Tax Owing</td>
              <td className="amount">{CAD(taxEstimate.totalTax)}</td>
            </tr>
            <tr>
              <td>Net GST Owing</td>
              <td className="amount">{CAD(taxEstimate.gstOwing)}</td>
            </tr>
            <tr className="total-row grand-total highlight">
              <td>Total Estimated Owing</td>
              <td className="amount">{CAD(taxEstimate.totalOwing)}</td>
            </tr>
          </tbody>
        </table>
        <p className="print-note">⚠️ Estimates only — confirm with your CPA. Based on BC small business rates (11% combined).</p>
      </section>

      {/* Transaction Journal */}
      {transactions.length > 0 && (
        <section className="print-section print-break">
          <h2>Transaction Journal</h2>
          <table className="print-table tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Debit</th>
                <th>Credit</th>
                <th className="amount">Amount</th>
                <th className="amount">GST</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className={t.flaggedForReview ? "flagged" : ""}>
                  <td className="nowrap">{t.date}</td>
                  <td>{t.description}{t.flaggedForReview ? " ⚠️" : ""}</td>
                  <td>{categoryLabel[t.category] || t.category}</td>
                  <td className="small-text">{t.accountDebit}</td>
                  <td className="small-text">{t.accountCredit}</td>
                  <td className="amount mono">{CAD(t.amount)}</td>
                  <td className="amount mono">{CAD(t.gstAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={5}>Total Transactions: {transactions.length}</td>
                <td className="amount mono">{CAD(transactions.reduce((s, t) => s + t.amount, 0))}</td>
                <td className="amount mono">{CAD(transactions.reduce((s, t) => s + t.gstAmount, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <p className="print-footer">My Sister&apos;s Taxes — {today}</p>

      <style>{`
        .print-doc {
          font-family: Georgia, serif;
          font-size: 11px;
          color: #111;
          max-width: 900px;
          margin: 0 auto;
          padding: 32px 40px;
        }
        .print-header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #111; padding-bottom: 16px; }
        .print-header h1 { font-size: 22px; font-weight: bold; margin: 0 0 4px; }
        .print-subtitle { font-size: 14px; margin: 4px 0; }
        .print-meta { font-size: 10px; color: #555; margin: 4px 0 0; }
        .print-section { margin-bottom: 28px; }
        .print-section h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table td, .print-table th { padding: 3px 6px; vertical-align: top; }
        .print-table th { font-weight: bold; border-bottom: 1px solid #888; text-align: left; font-size: 10px; text-transform: uppercase; }
        .print-table th.amount, .print-table td.amount { text-align: right; }
        .section-header td { font-weight: bold; padding-top: 8px; }
        .indent { padding-left: 20px !important; }
        .subtotal td { border-top: 1px solid #bbb; font-style: italic; }
        .total-row td { font-weight: bold; border-top: 1px solid #888; }
        .grand-total td { font-size: 12px; }
        .highlight td { background: #f5f5f5; }
        .spacer td { height: 8px; }
        .mono { font-family: 'Courier New', monospace; }
        .small-text { font-size: 9px; color: #444; }
        .nowrap { white-space: nowrap; }
        .tx-table tbody tr:nth-child(even) { background: #fafafa; }
        .flagged { background: #fffbeb !important; }
        .print-note { font-size: 9px; color: #666; margin-top: 6px; font-style: italic; }
        .print-footer { text-align: center; font-size: 9px; color: #888; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 8px; }
        .print-break { page-break-before: always; }
        @media print {
          .print-doc { padding: 0; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
