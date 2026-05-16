import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { getSystemPrompt } from "@/lib/system-prompt";

const XAI_API_URL = "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL || "grok-4.3";

type XaiToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type XaiMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: XaiToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

type XaiChatResponse = {
  choices?: Array<{
    message: {
      content?: string | null;
      tool_calls?: XaiToolCall[];
    };
  }>;
  error?: { message?: string };
};

const tools = [
  {
    type: "function",
    function: {
      name: "log_transaction",
      description:
        "Log a business transaction as a double-entry journal entry. Use this for every transaction the user mentions.",
      parameters: {
        type: "object",
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
            description:
              "Whether this is a capital asset (over $500, lasting >1 year)",
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
  },
  {
    type: "function",
    function: {
      name: "query_transactions",
      description:
        "Query the transaction database to answer questions like 'how much revenue this year', 'total expenses in January', etc.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "delete_last_transaction",
      description:
        "Delete the most recent transaction. Use when the user says 'undo that', 'delete that', 'remove the last entry', etc.",
      parameters: {
        type: "object",
        properties: {
          confirm: {
            type: "boolean",
            description: "Confirm deletion",
          },
        },
        required: ["confirm"],
      },
    },
  },
];

async function createChatCompletion(messages: XaiMessage[]) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  const response = await fetch(`${XAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      max_tokens: 4096,
      messages,
      tools,
    }),
  });

  const payload = (await response.json()) as XaiChatResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Grok chat request failed");
  }

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error("Grok returned no chat message");
  }

  return message;
}

async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (name) {
    case "log_transaction": {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
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

      const where: Record<string, unknown> = { userId };
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
        where: { userId },
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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get active tax year for this user
    const yearSetting = await prisma.settings.findUnique({
      where: { userId_key: { userId, key: "active_tax_year" } },
    });
    const activeTaxYear = yearSetting?.value || String(new Date().getFullYear());

    // Save user message
    await prisma.message.create({
      data: { userId, role: "user", content: message },
    });

    // Get recent conversation history for context
    const recentMessages = await prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const systemPrompt = getSystemPrompt(activeTaxYear);
    const conversationHistory: XaiMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map(
        (msg): XaiMessage => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })
      ),
    ];

    let responseMessage = await createChatCompletion(conversationHistory);

    // Process tool calls in a loop
    let toolCallIterations = 0;
    while (responseMessage.tool_calls?.length) {
      if (toolCallIterations >= 8) {
        throw new Error("Grok exceeded the tool call limit");
      }
      toolCallIterations++;

      conversationHistory.push({
        role: "assistant",
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls,
      });

      for (const toolCall of responseMessage.tool_calls) {
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          input = {};
        }

        const result = await handleToolCall(
          toolCall.function.name,
          input,
          userId,
        );

        conversationHistory.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      responseMessage = await createChatCompletion(conversationHistory);
    }

    const assistantMessage = responseMessage.content || "";

    // Save assistant message
    await prisma.message.create({
      data: { userId, role: "assistant", content: assistantMessage },
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
