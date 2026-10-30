import { z } from "zod";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { prisma } from "@/server/db/client.ts";
import { linkMedia } from "@/server/services/media.ts";
import { NotFoundError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  buyerId: z.string().optional(),
  sellerId: z.string().optional(),
});

export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, BodySchema);
  const media = await prisma.mediaAttachment.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!media) throw new NotFoundError("Media not found.");
  await linkMedia(id, body.buyerId ? [body.buyerId] : [], body.sellerId ? [body.sellerId] : []);
  return ok({ id, attached: true });
});
