import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
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
