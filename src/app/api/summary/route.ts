import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const currentYear = new Date().getFullYear().toString();
    const transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: `${currentYear}-01-01`,
          lte: `${currentYear}-12-31`,
        },
      },
    });

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalCogs = 0;
    let gstCollected = 0;
    let gstPaid = 0;
    let capitalAssets = 0;

    const monthlyData: Record<
      string,
      { revenue: number; expenses: number }
    > = {};

    // Initialize all months
    for (let m = 1; m <= 12; m++) {
      const key = `${currentYear}-${String(m).padStart(2, "0")}`;
      monthlyData[key] = { revenue: 0, expenses: 0 };
    }

    for (const t of transactions) {
      const month = t.date.substring(0, 7); // YYYY-MM

      switch (t.category) {
        case "revenue":
          totalRevenue += t.amount;
          gstCollected += t.gstAmount;
          if (monthlyData[month]) monthlyData[month].revenue += t.amount;
          break;
        case "cogs":
          totalCogs += t.amount;
          gstPaid += t.gstAmount;
          if (monthlyData[month]) monthlyData[month].expenses += t.amount;
          break;
        case "operating_expense":
          totalExpenses += t.amount;
          gstPaid += t.gstAmount;
          if (monthlyData[month]) monthlyData[month].expenses += t.amount;
          break;
        case "capital_asset":
          capitalAssets += t.amount;
          gstPaid += t.gstAmount;
          break;
      }
    }

    const netIncome = totalRevenue - totalExpenses - totalCogs;
    const netGst = gstCollected - gstPaid;

    const monthly = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-CA", {
          month: "short",
        }),
        ...data,
      }));

    return NextResponse.json({
      totalRevenue,
      totalExpenses: totalExpenses + totalCogs,
      netIncome,
      gstCollected,
      gstPaid,
      netGst,
      capitalAssets,
      transactionCount: transactions.length,
      monthly,
    });
  } catch (error) {
    console.error("Summary API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
