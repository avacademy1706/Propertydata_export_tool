import { z } from "zod";
import { cookies } from "next/headers";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getConfig } from "@/server/config/env.ts";
import { createSessionToken, verifyCredentials, sessionCookieOptions, SESSION_COOKIE } from "@/server/auth/session.ts";
import { UnauthorizedError, ConfigurationError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().min(1, "Email is required.").max(200),
  password: z.string().min(1, "Password is required.").max(200),
});

export const POST = withErrorHandling(async (request: Request) => {
  const { email, password } = await parseBody(request, BodySchema);
  if (!getConfig().auth.enabled) {
    throw new ConfigurationError("Authentication is not enabled on this server.");
  }
  if (!verifyCredentials(email, password)) {
    throw new UnauthorizedError("Incorrect email or password.");
  }
  const token = createSessionToken(email);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return ok({ email: email.trim().toLowerCase() });
});
