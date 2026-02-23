import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { cookies } from "next/headers";

const COOKIE_NAME = "x-impersonate-user-id";

// Start impersonating a user
export async function POST(request: NextRequest) {
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return NextResponse.json({ success: true, impersonating: userId });
}

// Stop impersonating
export async function DELETE() {
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ success: true });
}

// Check current impersonation status
export async function GET() {
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const impersonating = cookieStore.get(COOKIE_NAME)?.value || null;

  return NextResponse.json({ impersonating });
}
