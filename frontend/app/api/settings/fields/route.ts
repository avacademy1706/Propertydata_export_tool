import { withErrorHandling, parseBody, parseQuery, ok, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { listFields, createField } from "@/server/services/fields.ts";
import { z } from "zod";

export const runtime = "nodejs";

const QuerySchema = z.object({
  entity: z.enum(["BUYER", "SELLER"]).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export const GET = withErrorHandling(async (request: Request) => {
  const params = parseQuery(request.url, QuerySchema);
  const { tenantId } = await getTenantContext();
  const fields = await listFields(tenantId, { entity: params.entity, activeOnly: params.activeOnly });
  return json({ success: true, fields });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await parseBody(request, z.record(z.string(), z.unknown()));
  const { tenantId } = await getTenantContext();
  const field = await createField(tenantId, body);
  return ok({ field }, { status: 201 });
});
