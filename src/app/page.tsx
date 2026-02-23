import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Check if user has signed up (password exists)
  const hasPassword = await prisma.settings.findUnique({
    where: { key: "user_password" },
  });

  if (!hasPassword) {
    redirect("/welcome");
  }

  redirect("/chat");
}
