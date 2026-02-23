import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = await createClient();

  // Signup flow
  if (body.signup) {
    const { email, password, name, company, year } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name?.trim() || "",
          company: company?.trim() || "",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Save settings (name, company, year)
    const settings: Record<string, string> = {
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

    return NextResponse.json({ success: true });
  }

  // Login flow
  const { email, password } = body;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
