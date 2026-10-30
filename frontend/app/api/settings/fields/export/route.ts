import { withErrorHandling, json } from "@/server/lib/http.ts";
import { getTenantContext } from "@/server/db/tenant.ts";
import { exportFieldConfig } from "@/server/services/fields.ts";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const { tenantId } = await getTenantContext();
  const config = await exportFieldConfig(tenantId);
  return json(config, {
    headers: {
      "Content-Disposition": 'attachment; filename="field-config.json"',
      "Content-Type": "application/json",
    },
  });
});
