import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

const XAI_API_URL = "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-4.3";

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

type XaiInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" }
  | { type: "input_file"; file_id: string };

type XaiResponse = {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: { message?: string };
};

async function uploadFileToXai(file: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("expires_after", "86400");
  formData.append("purpose", "assistants");
  formData.append("file", file, file.name);

  const response = await fetch(`${XAI_API_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || "Failed to upload file to xAI");
  }

  return payload.id;
}

async function parseWithGrok(content: XaiInputContent[]): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  const response = await fetch(`${XAI_API_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: [{ role: "user", content }],
    }),
  });

  const payload = (await response.json()) as XaiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Grok failed to parse document");
  }

  const text = payload.output
    ?.flatMap((item) => item.content || [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("Grok returned no text");
  }

  return text;
}

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

    let content: XaiInputContent[];

    if (isCSV) {
      const text = await file.text();
      content = [
        {
          type: "text",
          text: `${PARSE_PROMPT}\n\nHere is the CSV data:\n\n${text}`,
        },
      ];
    } else if (isPDF) {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        throw new Error("XAI_API_KEY is not configured");
      }
      const fileId = await uploadFileToXai(file, apiKey);
      content = [
        {
          type: "input_text",
          text: PARSE_PROMPT,
        },
        {
          type: "input_file",
          file_id: fileId,
        },
      ];
    } else {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mediaType = fileName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
      content = [
        {
          type: "input_image",
          image_url: `data:${mediaType};base64,${base64}`,
          detail: "high",
        },
        {
          type: "input_text",
          text: PARSE_PROMPT,
        },
      ];
    }

    const responseText = await parseWithGrok(content);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
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
          error: "Failed to parse Grok's response as JSON",
          raw: responseText,
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
