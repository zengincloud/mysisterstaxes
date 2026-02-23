import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all distinct users from settings (owner_name + company_name)
  const settings = await prisma.settings.findMany({
    where: {
      key: { in: ["owner_name", "company_name"] },
      userId: { not: "" },
    },
  });

  // Group by userId
  const userMap: Record<string, { name: string; company: string }> = {};
  for (const s of settings) {
    if (!userMap[s.userId]) {
      userMap[s.userId] = { name: "", company: "" };
    }
    if (s.key === "owner_name") userMap[s.userId].name = s.value;
    if (s.key === "company_name") userMap[s.userId].company = s.value;
  }

  const users = Object.entries(userMap).map(([id, info]) => ({
    id,
    name: info.name || "Unknown",
    company: info.company || "",
  }));

  return NextResponse.json(users);
}
