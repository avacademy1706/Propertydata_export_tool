import { withErrorHandling, json } from "@/server/lib/http.ts";
import { getConfig } from "@/server/config/env.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { getDashboardSummary } from "@/server/services/queries.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const cfg = getConfig();
  const { tenantId } = await getTenantContext();
  const summary = await getDashboardSummary(tenantId);
  return json({
    success: true,
    whatsapp: {
      configured: cfg.whatsapp.configured,
      missing: cfg.whatsapp.missing,
      businessNumber: cfg.whatsapp.businessNumber ?? null,
      status: cfg.whatsapp.configured ? "connected" : "configuration_required",
    },
    ai: { provider: cfg.ai.provider, model: cfg.ai.model, configured: cfg.ai.configured, visionEnabled: cfg.ai.visionEnabled },
    gridcraftWebUrl: cfg.gridcraftWebUrl ?? null,
    warnings: cfg.warnings,
    summary,
  });
});
