import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use query param year, or fall back to active tax year setting
    const { searchParams } = new URL(request.url);
    let year = searchParams.get("year");

    if (!year) {
      const yearSetting = await prisma.settings.findUnique({
        where: { userId_key: { userId, key: "active_tax_year" } },
      });
      year = yearSetting?.value || new Date().getFullYear().toString();
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: `${year}-01-01`,
          lte: `${year}-12-31`,
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
      const key = `${year}-${String(m).padStart(2, "0")}`;
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
      year,
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
