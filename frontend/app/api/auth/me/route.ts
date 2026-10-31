import { cookies } from "next/headers";
import { withErrorHandling, json } from "@/server/lib/http.ts";
import { getConfig } from "@/server/config/env.ts";
import { verifySessionToken, SESSION_COOKIE } from "@/server/auth/session.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const authEnabled = getConfig().auth.enabled;
  // When auth is disabled (trusted local dev), report an anonymous session.
  if (!authEnabled) {
    return json({ success: true, authEnabled: false, user: { email: "local" } });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return json({ success: false, authEnabled: true, user: null }, { status: 401 });
  }
  return json({ success: true, authEnabled: true, user: { email: session.email } });
});
