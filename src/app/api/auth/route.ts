import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, logout, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Signup flow: includes name, company, password, year
  if (body.signup) {
    const { name, company, password, year } = body;

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    // Save all settings
    const settings = {
      user_password: hashPassword(password),
      owner_name: name?.trim() || "there",
      company_name: company?.trim() || "",
      active_tax_year: year || String(new Date().getFullYear()),
      onboarded: "true",
    };

    for (const [key, value] of Object.entries(settings)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    await createSession();
    return NextResponse.json({ success: true });
  }

  // Login flow: just password
  const { password } = body;

  if (!(await checkPassword(password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  await logout();
  return NextResponse.json({ success: true });
}
