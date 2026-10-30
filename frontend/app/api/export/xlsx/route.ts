import { withErrorHandling } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { buildWorkbook } from "@/server/export/workbook.ts";
import { listBuyers, listSellers } from "@/server/services/queries.ts";
import { parseQuery } from "@/server/lib/http.ts";
import { ListQuerySchema } from "@/server/lib/query-schema.ts";
import { z } from "zod";

export const runtime = "nodejs";

const ExportQuerySchema = ListQuerySchema.extend({ scope: z.enum(["all", "filtered"]).default("all") });

export const GET = withErrorHandling(async (request: Request) => {
  const params = parseQuery(request.url, ExportQuerySchema);
  const { tenantId } = await getTenantContext();

  let filters: { buyerIds?: string[]; sellerIds?: string[] } = {};
  if (params.scope === "filtered") {
    // Apply the same filters the user sees, then export just those ids.
    const [buyers, sellers] = await Promise.all([
      listBuyers(tenantId, { ...params, pageSize: 200 }),
      listSellers(tenantId, { ...params, pageSize: 200 }),
    ]);
    filters = {
      buyerIds: buyers.items.map((b) => b.id),
      sellerIds: sellers.items.map((s) => s.id),
    };
  }

  const { buffer, filename } = await buildWorkbook(tenantId, filters);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
