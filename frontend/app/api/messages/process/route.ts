import { z } from "zod";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { processMessage } from "@/server/services/ingest.ts";

export const runtime = "nodejs";
// AI extraction can take 10-30s; raise the serverless timeout (Vercel caps Hobby at 60s).
export const maxDuration = 60;

const BodySchema = z.object({
  text: z.string().min(1, "Message text is required.").max(20000),
  hint: z.enum(["auto", "buyer", "seller"]).default("auto"),
  source: z.enum(["manual"]).default("manual"),
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await parseBody(request, BodySchema);
  const { tenantId } = await getTenantContext();
  const result = await processMessage({
    tenantId,
    text: body.text,
    hint: body.hint,
    channel: "MANUAL",
    actor: "manual",
  });
  return ok({
    detectedType: result.detectedType,
    status: result.status,
    duplicate: result.duplicate,
    confidence: result.confidence,
    createdRecords: result.createdRecords,
    needsReview: result.needsReview,
    reviewReasons: result.reviewReasons,
    summary: result.summary,
    messageId: result.messageId,
    message: result.message,
  });
});
