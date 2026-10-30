import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, ValidationError } from "@/server/lib/errors.ts";
import { logger } from "@/server/lib/logger.ts";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function ok<T extends object>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, ...data }, init);
}

export function fail(message: string, status = 400, code = "bad_request", details?: unknown) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

/** Parse a JSON body against a schema; throws ValidationError on failure. */
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Request validation failed.", formatZodIssues(result.error));
  }
  return result.data;
}

export function parseQuery<T>(url: string | URL, schema: z.ZodType<T>): T {
  const u = typeof url === "string" ? new URL(url) : url;
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of u.searchParams.entries()) {
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else obj[k] = [existing, v];
  }
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters.", formatZodIssues(result.error));
  }
  return result.data;
}

export function formatZodIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * Wrap a route handler so thrown errors become safe JSON responses.
 * Stack traces are never returned to the client.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        if (err.status >= 500) logger.error("request failed", { code: err.code, message: err.message });
        return fail(err.message, err.status, err.code, err.details);
      }
      logger.error("unhandled request error", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return fail("Something went wrong while processing your request.", 500, "internal_error");
    }
  };
}
