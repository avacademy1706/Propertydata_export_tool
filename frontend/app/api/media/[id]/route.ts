import { withErrorHandling, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { getMediaBuffer, softDeleteMedia } from "@/server/services/media.ts";
import { NotFoundError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const thumbnail = new URL(request.url).searchParams.get("thumbnail") === "1";
  const result = await getMediaBuffer(tenantId, id, thumbnail);
  if (!result) throw new NotFoundError("Media not found.");
  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const deleted = await softDeleteMedia(tenantId, id);
  if (!deleted) throw new NotFoundError("Media not found.");
  return ok({ id, deleted: true });
});
