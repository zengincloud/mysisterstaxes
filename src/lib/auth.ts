import { cookies } from "next/headers";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "default-dev-secret-change-me";
const PASSWORD = process.env.APP_PASSWORD || "taxtime2024";
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

export function checkPassword(password: string): boolean {
  return password === PASSWORD;
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
