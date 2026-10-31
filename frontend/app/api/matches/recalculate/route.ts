import { withErrorHandling, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { recalculateAll } from "@/server/matching/engine.ts";

export const runtime = "nodejs";
// Recomputing every match can be slow with many records; raise the serverless timeout.
export const maxDuration = 60;

export const POST = withErrorHandling(async () => {
  const { tenantId } = await getTenantContext();
  const count = await recalculateAll(tenantId);
  return ok({ matches: count, message: `Recalculated ${count} matches.` });
});
