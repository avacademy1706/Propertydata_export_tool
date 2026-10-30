import { z } from "zod";
import { withErrorHandling, parseBody, ok, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { prisma } from "@/server/db/client.ts";
import { normalizePhone } from "@/server/lib/phone.ts";
import { ValidationError } from "@/server/lib/errors.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const { tenantId } = await getTenantContext();
  const senders = await prisma.authorizedSender.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  return json({
    success: true,
    senders: senders.map((s) => ({
      id: s.id,
      phone: s.phoneE164,
      displayName: s.displayName,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

const CreateSchema = z.object({
  phone: z.string().min(5),
  displayName: z.string().optional(),
  status: z.enum(["APPROVED", "PENDING", "BLOCKED"]).default("APPROVED"),
});

export const POST = withErrorHandling(async (request: Request) => {
  const { tenantId } = await getTenantContext();
  const body = await parseBody(request, CreateSchema);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new ValidationError("Phone number could not be normalized to E.164.");
  const sender = await prisma.authorizedSender.upsert({
    where: { phoneE164: phone },
    update: { displayName: body.displayName, status: body.status, tenantId },
    create: { tenantId, phoneE164: phone, displayName: body.displayName, status: body.status },
  });
  return ok({ sender: { id: sender.id, phone: sender.phoneE164, status: sender.status } });
});
