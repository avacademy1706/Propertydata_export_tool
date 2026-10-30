import { withErrorHandling, parseQuery, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { listMatches } from "@/server/services/queries.ts";
import { MatchQuerySchema } from "@/server/lib/query-schema.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (request: Request) => {
  const params = parseQuery(request.url, MatchQuerySchema);
  const { tenantId } = await getTenantContext();
  const result = await listMatches(tenantId, params);
  return json({ success: true, ...result });
});
