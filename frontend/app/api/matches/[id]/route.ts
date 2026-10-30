import { z } from "zod";
import { withErrorHandling, parseBody, ok } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { prisma } from "@/server/db/client.ts";
import { NotFoundError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  status: z.enum(["NEW", "REVIEWED", "CONTACTED", "SHORTLISTED", "REJECTED"]),
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, BodySchema);
  const existing = await prisma.match.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Match not found.");
  const match = await prisma.match.update({ where: { id }, data: { status: body.status } });
  return ok({ match: { id: match.id, status: match.status } });
});
