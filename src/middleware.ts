import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "mst_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Simple check: cookie exists and has the right prefix
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !token.includes("authenticated:")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
