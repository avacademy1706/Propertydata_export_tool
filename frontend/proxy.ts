import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/server/config/env.ts";
import { verifySessionToken, SESSION_COOKIE } from "@/server/auth/session.ts";

/**
 * Route gate. When authentication is enabled (APP_ACCESS_PASSWORD set), requests
 * without a valid session cookie are redirected to /login (pages) or rejected
 * with 401 (API). The login flow, the WhatsApp webhook (authenticated by Meta
 * signature), and static assets are always public. When auth is disabled this is
 * a no-op.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let authEnabled = false;
  try {
    authEnabled = getConfig().auth.enabled;
  } catch {
    authEnabled = false;
  }
  if (!authEnabled) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (pathname && pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
