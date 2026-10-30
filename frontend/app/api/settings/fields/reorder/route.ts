import { z } from "zod";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { reorderFields } from "@/server/services/fields.ts";

export const runtime = "nodejs";

const BodySchema = z.object({
  order: z.array(z.object({ id: z.string(), displayOrder: z.number().int() })),
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await parseBody(request, BodySchema);
  const { tenantId } = await getTenantContext();
  await reorderFields(tenantId, body.order);
  return ok({ reordered: body.order.length });
});
