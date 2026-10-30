import "dotenv/config";
import { prisma, disconnectPrisma } from "@/server/db/client.ts";
import { getDefaultTenantId } from "@/server/db/tenant.ts";
import { seedFieldDefinitions } from "@/server/services/fields.ts";
import { processMessage } from "@/server/services/ingest.ts";

/**
 * Seeds the default tenant, field catalogue, an example (unverified) land-unit
 * conversion, and the four demo messages from the specification. Uses the
 * normal ingest pipeline so matches are generated exactly as in production.
 */

const DEMO_MESSAGES: Array<{ text: string; hint: "auto" | "buyer" | "seller" }> = [
  {
    text: "3 BHK flat for sale in Gomti Nagar, 1300 sqft, 2 balcony, 2 bathroom, covered car parking, 65 lakh. East facing.",
    hint: "auto",
  },
  {
    text: "Need 3 BHK flat in Gomti Nagar, budget 70 lakh, covered parking and lift required.",
    hint: "auto",
  },
  {
    text: "Shop for rent 400 sqft, near Spencer Indira Nagar. Rent 35k. Good location.",
    hint: "auto",
  },
  {
    text: "Required 10000 sq ft plot at Bijnor Road for petrol pump. 100x100. Budget 16k/sqft.",
    hint: "auto",
  },
];

async function main() {
  const tenantId = await getDefaultTenantId();
  const fields = await seedFieldDefinitions(tenantId);
  console.log(`Seeded ${fields} field definitions.`);

  // Example region conversion, left UNVERIFIED on purpose: the app will not
  // silently convert bigha/biswa until an administrator verifies a region rule.
  await prisma.landUnitConversion.upsert({
    where: { tenantId_unit_region: { tenantId, unit: "bigha", region: "Lucknow, Uttar Pradesh" } },
    update: {},
    create: {
      tenantId,
      unit: "bigha",
      region: "Lucknow, Uttar Pradesh",
      sqFtPerUnit: 27000,
      verified: false,
      notes: "Example only. Verify the correct local factor before enabling conversion.",
    },
  });

  // Clear previous demo data so re-seeding is idempotent.
  await prisma.match.deleteMany({ where: { tenantId } });
  await prisma.buyer.deleteMany({ where: { tenantId } });
  await prisma.seller.deleteMany({ where: { tenantId } });
  await prisma.sourceMessage.deleteMany({ where: { tenantId } });

  for (const demo of DEMO_MESSAGES) {
    const result = await processMessage({
      tenantId,
      text: demo.text,
      hint: demo.hint,
      channel: "MANUAL",
      actor: "seed",
    });
    console.log(`- ${result.detectedType.padEnd(7)} | ${result.summary}`);
  }

  const [buyers, sellers, matches] = await Promise.all([
    prisma.buyer.count({ where: { tenantId } }),
    prisma.seller.count({ where: { tenantId } }),
    prisma.match.count({ where: { tenantId } }),
  ]);
  console.log(`\nSeed complete: ${buyers} buyers, ${sellers} sellers, ${matches} matches.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
