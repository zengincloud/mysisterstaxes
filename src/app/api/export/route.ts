import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let year = searchParams.get("year");

    if (!year) {
      const yearSetting = await prisma.settings.findUnique({
        where: { userId_key: { userId, key: "active_tax_year" } },
      });
      year = yearSetting?.value || null;
    }

    const where = year
      ? { userId, date: { gte: `${year}-01-01`, lte: `${year}-12-31` } }
      : { userId };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "asc" },
    });

    const headers = [
      "ID",
      "Date",
      "Description",
      "Amount",
      "Category",
      "Debit Account",
      "Credit Account",
      "GST Amount",
      "Capital Asset",
      "CCA Class",
      "CCA Rate",
      "Notes",
      "Flagged for Review",
    ];

    const rows = transactions.map((t) => [
      t.id,
      t.date,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.category,
      `"${t.accountDebit}"`,
      `"${t.accountCredit}"`,
      t.gstAmount.toFixed(2),
      t.isCapitalAsset ? "Yes" : "No",
      t.ccaClass || "",
      t.ccaRate ? (t.ccaRate * 100).toFixed(0) + "%" : "",
      `"${(t.notes || "").replace(/"/g, '""')}"`,
      t.flaggedForReview ? "Yes" : "No",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
