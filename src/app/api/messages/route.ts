import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    const messages = await prisma.message.findMany({
      where: {
        userId,
        sessionId: sessionId ? parseInt(sessionId) : undefined,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Messages API error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    await prisma.message.deleteMany({
      where: {
        userId,
        sessionId: sessionId ? parseInt(sessionId) : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Messages API error:", error);
    return NextResponse.json({ error: "Failed to clear messages" }, { status: 500 });
  }
}
