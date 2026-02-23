import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PARSE_PROMPT = `You are a bookkeeping transaction extractor for a small business in British Columbia, Canada (5% GST).

I'm giving you a financial document (bank statement, credit card statement, receipt, or CSV export). Extract every transaction and return them as a JSON array.

For each transaction, return:
{
  "date": "YYYY-MM-DD",
  "description": "brief description",
  "amount": 123.45,
  "category": "revenue" | "cogs" | "operating_expense" | "capital_asset",
  "account_debit": "account number and name (e.g. '5200 Office Supplies')",
  "account_credit": "account number and name (e.g. '1000 Cash / Bank')",
  "gst_amount": 6.17,
  "is_capital_asset": false,
  "cca_class": null,
  "cca_rate": null,
  "notes": null,
  "flagged_for_review": false
}

Rules:
- For expenses paid by the business: debit the expense account, credit 1000 Cash / Bank
- For revenue received: debit 1000 Cash / Bank, credit 4000 Revenue
- GST is 5% of the base amount
- Capital assets are purchases over $500 that last >1 year — flag these for review
- If uncertain about categorization, set flagged_for_review to true and add a note
- Use these account numbers: 1000 Cash/Bank, 1100 Accounts Receivable, 1500 Equipment, 2000 Accounts Payable, 2100 GST Collected, 2200 GST Paid (ITC), 4000 Revenue, 5000 Cost of Goods Sold, 5100 Advertising, 5200 Office Supplies, 5300 Rent, 5400 Utilities, 5500 Insurance, 5600 Professional Fees, 5700 Vehicle Expenses, 5800 Meals & Entertainment, 5900 Travel, 6000 Miscellaneous Expenses
- Skip any transactions that are internal transfers, payments to credit cards from bank accounts, or duplicate entries
- Return ONLY the JSON array, no other text. If no transactions found, return []`;

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const yearOverride = formData.get("year") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isPDF = fileName.endsWith(".pdf");
    const isImage =
      fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg");

    if (!isCSV && !isPDF && !isImage) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV, PDF, or image files." },
        { status: 400 }
      );
    }

    let content: Anthropic.ContentBlockParam[];

    if (isCSV) {
      const text = await file.text();
      content = [
        {
          type: "text",
          text: `${PARSE_PROMPT}\n\nHere is the CSV data:\n\n${text}`,
        },
      ];
    } else if (isPDF) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      content = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as unknown as Anthropic.ContentBlockParam,
        {
          type: "text",
          text: PARSE_PROMPT,
        },
      ];
    } else {
      // Image
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mediaType = fileName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
      content = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64,
          },
        } as unknown as Anthropic.ContentBlockParam,
        {
          type: "text",
          text: PARSE_PROMPT,
        },
      ];
    }

    // Send to Claude for parsing
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock) {
      return NextResponse.json(
        { error: "Failed to parse document" },
        { status: 500 }
      );
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let transactions: Array<Record<string, unknown>>;
    try {
      transactions = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse Claude's response as JSON",
          raw: textBlock.text,
        },
        { status: 500 }
      );
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        message: "No transactions found in the document.",
      });
    }

    // Get active tax year
    let activeYear = yearOverride;
    if (!activeYear) {
      const yearSetting = await prisma.settings.findUnique({
        where: { userId_key: { userId, key: "active_tax_year" } },
      });
      activeYear = yearSetting?.value || String(new Date().getFullYear());
    }

    // Insert transactions
    let imported = 0;
    let flagged = 0;

    for (const t of transactions) {
      // Validate date is within active year if no override
      let date = String(t.date || "");
      if (!date.startsWith(activeYear)) {
        date = `${activeYear}${date.substring(4)}`;
      }

      const record = await prisma.transaction.create({
        data: {
          userId,
          date,
          description: String(t.description || ""),
          amount: Number(t.amount) || 0,
          category: String(t.category || "operating_expense"),
          accountDebit: String(t.account_debit || "6000 Miscellaneous Expenses"),
          accountCredit: String(t.account_credit || "1000 Cash / Bank"),
          gstAmount: Number(t.gst_amount) || 0,
          isCapitalAsset: Boolean(t.is_capital_asset),
          ccaClass: t.cca_class ? String(t.cca_class) : null,
          ccaRate: t.cca_rate ? Number(t.cca_rate) : null,
          notes: t.notes ? String(t.notes) : null,
          flaggedForReview: Boolean(t.flagged_for_review),
        },
      });

      imported++;
      if (record.flaggedForReview) flagged++;
    }

    return NextResponse.json({
      success: true,
      imported,
      flagged,
      message: `Imported ${imported} transaction${imported !== 1 ? "s" : ""}${
        flagged > 0 ? ` (${flagged} flagged for review)` : ""
      }.`,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
