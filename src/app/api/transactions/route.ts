import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let year = searchParams.get("year");

    if (!year) {
      const yearSetting = await prisma.settings.findUnique({
        where: { key: "active_tax_year" },
      });
      year = yearSetting?.value || null;
    }

    const where = year
      ? { date: { gte: `${year}-01-01`, lte: `${year}-12-31` } }
      : {};

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Transactions API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...data } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        date: data.date,
        description: data.description,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        category: data.category,
        accountDebit: data.accountDebit,
        accountCredit: data.accountCredit,
        gstAmount: data.gstAmount ? parseFloat(data.gstAmount) : undefined,
        isCapitalAsset: data.isCapitalAsset,
        ccaClass: data.ccaClass,
        ccaRate: data.ccaRate ? parseFloat(data.ccaRate) : undefined,
        notes: data.notes,
        flaggedForReview: data.flaggedForReview,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Transactions API error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.transaction.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Transactions API error:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
