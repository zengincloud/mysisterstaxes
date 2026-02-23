import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.AUTH_SECRET || "default-dev-secret-change-me";
const COOKIE_NAME = "mst_session";

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(value);
  return `${value}.${hmac.digest("hex")}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.substring(0, idx);
  if (sign(value) === signed) return value;
  return null;
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function checkPassword(password: string): Promise<boolean> {
  const stored = await prisma.settings.findUnique({
    where: { key: "user_password" },
  });
  if (!stored) return false;
  return stored.value === hashPassword(password);
}

export async function createSession(): Promise<void> {
  const token = sign(`authenticated:${Date.now()}`);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const value = verify(token);
  return value !== null && value.startsWith("authenticated:");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
