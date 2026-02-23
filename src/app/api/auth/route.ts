import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, logout } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
