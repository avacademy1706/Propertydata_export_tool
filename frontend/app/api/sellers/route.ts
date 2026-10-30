import { withErrorHandling, parseQuery, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { listSellers } from "@/server/services/queries.ts";
import { ListQuerySchema } from "@/server/lib/query-schema.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (request: Request) => {
  const params = parseQuery(request.url, ListQuerySchema);
  const { tenantId } = await getTenantContext();
  const result = await listSellers(tenantId, params);
  return json({ success: true, ...result });
});
