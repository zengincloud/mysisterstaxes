import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// BC small business tax rates (approximate)
const SMALL_BIZ_FEDERAL_RATE = 0.09; // 9% federal small business rate
const SMALL_BIZ_BC_RATE = 0.02; // 2% BC small business rate
const TOTAL_SMALL_BIZ_RATE = SMALL_BIZ_FEDERAL_RATE + SMALL_BIZ_BC_RATE; // 11%

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const type = searchParams.get("type") || "all";

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: `${year}-01-01`,
          lte: `${year}-12-31`,
        },
      },
      orderBy: { date: "asc" },
    });

    // Calculate P&L
    let revenue = 0;
    let cogs = 0;
    const expenses: Record<string, number> = {};
    let totalExpenses = 0;
    let gstCollected = 0;
    let gstPaid = 0;
    let capitalAssets = 0;
    let ccaDepreciation = 0;

    // Assets / Liabilities tracking
    let cashInflows = 0;
    let cashOutflows = 0;
    let accountsReceivable = 0;
    let equipment = 0;

    for (const t of transactions) {
      switch (t.category) {
        case "revenue":
          revenue += t.amount;
          gstCollected += t.gstAmount;
          cashInflows += t.amount + t.gstAmount;
          if (t.accountDebit.includes("1100")) {
            accountsReceivable += t.amount + t.gstAmount;
            cashInflows -= t.amount + t.gstAmount;
          }
          break;
        case "cogs":
          cogs += t.amount;
          gstPaid += t.gstAmount;
          cashOutflows += t.amount + t.gstAmount;
          totalExpenses += t.amount;
          expenses["Cost of Goods Sold"] =
            (expenses["Cost of Goods Sold"] || 0) + t.amount;
          break;
        case "operating_expense": {
          totalExpenses += t.amount;
          gstPaid += t.gstAmount;
          cashOutflows += t.amount + t.gstAmount;
          const acctName = t.accountDebit.replace(/^\d+\s*/, "");
          expenses[acctName] = (expenses[acctName] || 0) + t.amount;
          break;
        }
        case "capital_asset":
          capitalAssets += t.amount;
          equipment += t.amount;
          gstPaid += t.gstAmount;
          cashOutflows += t.amount + t.gstAmount;
          if (t.ccaRate) {
            ccaDepreciation += t.amount * t.ccaRate * 0.5;
          }
          break;
      }
    }

    const grossProfit = revenue - cogs;
    const totalExpWithCCA = totalExpenses + ccaDepreciation;
    const netIncome = revenue - cogs - totalExpWithCCA + (cogs > 0 ? cogs : 0);
    const netIncomeBeforeTax = grossProfit - (totalExpenses - cogs) - ccaDepreciation;
    const estimatedTax = Math.max(0, netIncomeBeforeTax * TOTAL_SMALL_BIZ_RATE);
    const netIncomeAfterTax = netIncomeBeforeTax - estimatedTax;
    const netGst = gstCollected - gstPaid;

    const pnl = {
      revenue,
      cogs,
      grossProfit,
      expenses: Object.entries(expenses)
        .filter(([key]) => key !== "Cost of Goods Sold")
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      ccaDepreciation,
      totalExpenses: totalExpenses - cogs + ccaDepreciation,
      netIncomeBeforeTax,
      estimatedTax,
      netIncomeAfterTax,
    };

    const balanceSheet = {
      assets: {
        current: [
          { name: "Cash / Bank", amount: cashInflows - cashOutflows },
          { name: "Accounts Receivable", amount: accountsReceivable },
          { name: "GST Paid (ITC)", amount: gstPaid },
        ],
        longTerm: [
          {
            name: "Equipment (net of CCA)",
            amount: equipment - ccaDepreciation,
          },
        ],
        totalAssets:
          cashInflows -
          cashOutflows +
          accountsReceivable +
          gstPaid +
          equipment -
          ccaDepreciation,
      },
      liabilities: {
        current: [
          { name: "GST Collected", amount: gstCollected },
          { name: "Net GST Owing", amount: Math.max(0, netGst) },
          { name: "Estimated Tax Payable", amount: estimatedTax },
        ],
        totalLiabilities:
          gstCollected + Math.max(0, netGst) + estimatedTax,
      },
      equity: {
        retainedEarnings: netIncomeAfterTax,
      },
    };

    const cashFlow = {
      operating: {
        netIncome: netIncomeBeforeTax,
        addBack: [{ name: "CCA / Depreciation", amount: ccaDepreciation }],
        changes: [
          {
            name: "Increase in Accounts Receivable",
            amount: -accountsReceivable,
          },
          { name: "GST Net", amount: -(gstCollected - gstPaid) },
        ],
        totalOperating:
          netIncomeBeforeTax +
          ccaDepreciation -
          accountsReceivable -
          (gstCollected - gstPaid),
      },
      investing: {
        items: [
          { name: "Purchase of Equipment", amount: -equipment },
        ],
        totalInvesting: -equipment,
      },
      financing: {
        items: [] as Array<{ name: string; amount: number }>,
        totalFinancing: 0,
      },
      netChange:
        netIncomeBeforeTax +
        ccaDepreciation -
        accountsReceivable -
        (gstCollected - gstPaid) -
        equipment,
    };

    const taxEstimate = {
      netIncomeBeforeTax,
      federalRate: SMALL_BIZ_FEDERAL_RATE,
      bcRate: SMALL_BIZ_BC_RATE,
      federalTax: Math.max(0, netIncomeBeforeTax * SMALL_BIZ_FEDERAL_RATE),
      bcTax: Math.max(0, netIncomeBeforeTax * SMALL_BIZ_BC_RATE),
      totalTax: estimatedTax,
      gstOwing: Math.max(0, netGst),
      totalOwing: estimatedTax + Math.max(0, netGst),
    };

    // Available years for this user
    const allTransactions = await prisma.transaction.findMany({
      where: { userId },
      select: { date: true },
    });
    const years = [
      ...new Set(allTransactions.map((t) => t.date.substring(0, 4))),
    ].sort((a, b) => b.localeCompare(a));

    if (years.length === 0) {
      years.push(new Date().getFullYear().toString());
    }

    const result: Record<string, unknown> = {
      year,
      availableYears: years,
      transactionCount: transactions.length,
    };

    if (type === "all" || type === "pnl") result.pnl = pnl;
    if (type === "all" || type === "balance_sheet")
      result.balanceSheet = balanceSheet;
    if (type === "all" || type === "cash_flow") result.cashFlow = cashFlow;
    if (type === "all" || type === "tax_estimate")
      result.taxEstimate = taxEstimate;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Statements API error:", error);
    return NextResponse.json(
      { error: "Failed to generate statements" },
      { status: 500 }
    );
  }
}
