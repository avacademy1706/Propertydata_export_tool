import { cookies } from "next/headers";
import { withErrorHandling, ok } from "@/server/lib/http.ts";
import { sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session.ts";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(true));
  return ok({ loggedOut: true });
});
