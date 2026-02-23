import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSystemPrompt } from "@/lib/system-prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const tools: Anthropic.Tool[] = [
  {
    name: "log_transaction",
    description:
      "Log a business transaction as a double-entry journal entry. Use this for every transaction the user mentions.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Transaction date in YYYY-MM-DD format",
        },
        description: {
          type: "string",
          description: "Brief description of the transaction",
        },
        amount: {
          type: "number",
          description:
            "Transaction amount in CAD (before GST, the base amount)",
        },
        category: {
          type: "string",
          enum: ["revenue", "cogs", "operating_expense", "capital_asset"],
          description: "Transaction category",
        },
        account_debit: {
          type: "string",
          description:
            "Account number and name to debit (e.g., '1100 Accounts Receivable')",
        },
        account_credit: {
          type: "string",
          description:
            "Account number and name to credit (e.g., '4000 Revenue')",
        },
        gst_amount: {
          type: "number",
          description: "GST amount (5% of the base amount)",
        },
        is_capital_asset: {
          type: "boolean",
          description: "Whether this is a capital asset (over $500, lasting >1 year)",
        },
        cca_class: {
          type: "string",
          description:
            "CCA class if capital asset (e.g., 'Class 8', 'Class 10', 'Class 50')",
        },
        cca_rate: {
          type: "number",
          description: "CCA rate as decimal (e.g., 0.20 for 20%)",
        },
        notes: {
          type: "string",
          description: "Any additional notes or flags",
        },
        flagged_for_review: {
          type: "boolean",
          description:
            "Whether to flag this for CPA review (true if uncertain or capital asset)",
        },
      },
      required: [
        "date",
        "description",
        "amount",
        "category",
        "account_debit",
        "account_credit",
        "gst_amount",
        "is_capital_asset",
        "flagged_for_review",
      ],
    },
  },
  {
    name: "query_transactions",
    description:
      "Query the transaction database to answer questions like 'how much revenue this year', 'total expenses in January', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        query_type: {
          type: "string",
          enum: [
            "total_revenue",
            "total_expenses",
            "total_by_category",
            "recent_transactions",
            "gst_summary",
            "all_transactions",
          ],
          description: "Type of query to run",
        },
        start_date: {
          type: "string",
          description: "Start date filter (YYYY-MM-DD), optional",
        },
        end_date: {
          type: "string",
          description: "End date filter (YYYY-MM-DD), optional",
        },
        category: {
          type: "string",
          description: "Filter by category, optional",
        },
        limit: {
          type: "number",
          description: "Limit number of results, optional",
        },
      },
      required: ["query_type"],
    },
  },
  {
    name: "delete_last_transaction",
    description:
      "Delete the most recent transaction. Use when the user says 'undo that', 'delete that', 'remove the last entry', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirm: {
          type: "boolean",
          description: "Confirm deletion",
        },
      },
      required: ["confirm"],
    },
  },
];

async function handleToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "log_transaction": {
      const transaction = await prisma.transaction.create({
        data: {
          date: input.date as string,
          description: input.description as string,
          amount: input.amount as number,
          category: input.category as string,
          accountDebit: input.account_debit as string,
          accountCredit: input.account_credit as string,
          gstAmount: (input.gst_amount as number) || 0,
          isCapitalAsset: (input.is_capital_asset as boolean) || false,
          ccaClass: (input.cca_class as string) || null,
          ccaRate: (input.cca_rate as number) || null,
          notes: (input.notes as string) || null,
          flaggedForReview: (input.flagged_for_review as boolean) || false,
        },
      });
      return JSON.stringify({
        success: true,
        id: transaction.id,
        message: `Transaction #${transaction.id} logged successfully`,
      });
    }

    case "query_transactions": {
      const queryType = input.query_type as string;
      const startDate = input.start_date as string | undefined;
      const endDate = input.end_date as string | undefined;
      const category = input.category as string | undefined;
      const limit = (input.limit as number) || 20;

      const where: Record<string, unknown> = {};
      if (startDate || endDate) {
        where.date = {};
        if (startDate)
          (where.date as Record<string, string>).gte = startDate;
        if (endDate) (where.date as Record<string, string>).lte = endDate;
      }
      if (category) where.category = category;

      switch (queryType) {
        case "total_revenue": {
          const transactions = await prisma.transaction.findMany({
            where: { ...where, category: "revenue" },
          });
          const total = transactions.reduce((sum, t) => sum + t.amount, 0);
          return JSON.stringify({
            total_revenue: total,
            transaction_count: transactions.length,
          });
        }
        case "total_expenses": {
          const transactions = await prisma.transaction.findMany({
            where: {
              ...where,
              category: { in: ["operating_expense", "cogs"] },
            },
          });
          const total = transactions.reduce((sum, t) => sum + t.amount, 0);
          return JSON.stringify({
            total_expenses: total,
            transaction_count: transactions.length,
          });
        }
        case "total_by_category": {
          const transactions = await prisma.transaction.findMany({ where });
          const byCategory: Record<string, number> = {};
          for (const t of transactions) {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
          }
          return JSON.stringify(byCategory);
        }
        case "gst_summary": {
          const transactions = await prisma.transaction.findMany({ where });
          let gstCollected = 0;
          let gstPaid = 0;
          for (const t of transactions) {
            if (t.category === "revenue") {
              gstCollected += t.gstAmount;
            } else {
              gstPaid += t.gstAmount;
            }
          }
          return JSON.stringify({
            gst_collected: gstCollected,
            gst_paid_itc: gstPaid,
            net_gst_owing: gstCollected - gstPaid,
          });
        }
        case "recent_transactions": {
          const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
          });
          return JSON.stringify(transactions);
        }
        default: {
          const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
          });
          return JSON.stringify(transactions);
        }
      }
    }

    case "delete_last_transaction": {
      if (!input.confirm) {
        return JSON.stringify({
          success: false,
          message: "Deletion not confirmed",
        });
      }
      const last = await prisma.transaction.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (!last) {
        return JSON.stringify({
          success: false,
          message: "No transactions to delete",
        });
      }
      await prisma.transaction.delete({ where: { id: last.id } });
      return JSON.stringify({
        success: true,
        deleted: last,
        message: `Deleted transaction #${last.id}: ${last.description} ($${last.amount})`,
      });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get active tax year
    const yearSetting = await prisma.settings.findUnique({
      where: { key: "active_tax_year" },
    });
    const activeTaxYear = yearSetting?.value || String(new Date().getFullYear());

    // Save user message
    await prisma.message.create({
      data: { role: "user", content: message },
    });

    // Get recent conversation history for context
    const recentMessages = await prisma.message.findMany({
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const conversationHistory: Anthropic.MessageParam[] = recentMessages.map(
      (msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })
    );

    const systemPrompt = getSystemPrompt(activeTaxYear);

    // Call Claude with tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: conversationHistory,
    });

    // Process tool calls in a loop
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const tu = toolUse as unknown as { name: string; input: Record<string, unknown>; id: string };
        const result = await handleToolCall(
          tu.name,
          tu.input,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      // Continue conversation with tool results
      conversationHistory.push({
        role: "assistant",
        content: response.content as unknown as Anthropic.ContentBlockParam[],
      });
      conversationHistory.push({
        role: "user",
        content: toolResults,
      });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: conversationHistory,
      });
    }

    // Extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const assistantMessage = textBlocks.map((b) => b.text).join("\n");

    // Save assistant message
    await prisma.message.create({
      data: { role: "assistant", content: assistantMessage },
    });

    return NextResponse.json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
