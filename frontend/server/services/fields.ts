import { z } from "zod";
import type { Prisma, CustomFieldDefinition } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { FIELD_CATALOGUE } from "@/server/domain/field-catalogue.ts";
import { slugify } from "@/server/lib/text.ts";
import { ConflictError, NotFoundError, ValidationError } from "@/server/lib/errors.ts";

/** Seed the default field catalogue for a tenant (idempotent). */
export async function seedFieldDefinitions(tenantId: string): Promise<number> {
  const existing = await prisma.customFieldDefinition.count({ where: { tenantId } });
  if (existing > 0) return 0;
  await prisma.customFieldDefinition.createMany({
    data: FIELD_CATALOGUE.map((f) => ({ ...f, tenantId })),
    skipDuplicates: true,
  });
  return FIELD_CATALOGUE.length;
}

export async function listFields(tenantId: string, opts: { entity?: "BUYER" | "SELLER"; activeOnly?: boolean } = {}) {
  const where: Prisma.CustomFieldDefinitionWhereInput = { tenantId };
  if (opts.activeOnly) where.isActive = true;
  if (opts.entity) where.entityTypes = { in: [opts.entity, "BOTH"] };
  return prisma.customFieldDefinition.findMany({ where, orderBy: { displayOrder: "asc" } });
}

const FieldInputSchema = z.object({
  label: z.string().min(1).max(80),
  dataType: z.enum([
    "TEXT", "LONG_TEXT", "NUMBER", "DECIMAL", "CURRENCY", "DATE", "BOOLEAN",
    "SINGLE_SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL", "LOCATION", "MEASUREMENT", "MEDIA",
  ]),
  entityTypes: z.enum(["BUYER", "SELLER", "BOTH"]).default("BOTH"),
  options: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  unitOptions: z.array(z.string()).default([]),
  defaultValue: z.unknown().optional(),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isSearchable: z.boolean().default(false),
  showInTable: z.boolean().default(false),
  showInDetail: z.boolean().default(true),
  includeInExport: z.boolean().default(true),
  aiExtractable: z.boolean().default(true),
  manualEntry: z.boolean().default(true),
  fieldKey: z.string().optional(),
});

export async function createField(tenantId: string, input: unknown): Promise<CustomFieldDefinition> {
  const data = FieldInputSchema.parse(input);
  const fieldKey = data.fieldKey ? slugify(data.fieldKey) : slugify(data.label);
  if (!fieldKey) throw new ValidationError("Field key could not be derived from the label.");
  const clash = await prisma.customFieldDefinition.findUnique({
    where: { tenantId_fieldKey: { tenantId, fieldKey } },
  });
  if (clash) throw new ConflictError(`A field with key "${fieldKey}" already exists.`);
  const maxOrder = await prisma.customFieldDefinition.aggregate({ where: { tenantId }, _max: { displayOrder: true } });
  return prisma.customFieldDefinition.create({
    data: {
      tenantId,
      fieldKey,
      label: data.label,
      dataType: data.dataType,
      entityTypes: data.entityTypes,
      isCore: false,
      options: data.options as unknown as Prisma.InputJsonValue,
      aliases: data.aliases as unknown as Prisma.InputJsonValue,
      unitOptions: data.unitOptions as unknown as Prisma.InputJsonValue,
      defaultValue: (data.defaultValue ?? null) as Prisma.InputJsonValue,
      isRequired: data.isRequired,
      isActive: data.isActive,
      isSearchable: data.isSearchable,
      showInTable: data.showInTable,
      showInDetail: data.showInDetail,
      includeInExport: data.includeInExport,
      aiExtractable: data.aiExtractable,
      manualEntry: data.manualEntry,
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      exportOrder: (maxOrder._max.displayOrder ?? 0) + 1,
    },
  });
}

const FieldUpdateSchema = FieldInputSchema.partial().extend({ displayOrder: z.number().int().optional() });

export async function updateField(tenantId: string, id: string, input: unknown): Promise<CustomFieldDefinition> {
  const data = FieldUpdateSchema.parse(input);
  const existing = await prisma.customFieldDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Field not found.");
  // The stable fieldKey is never changed by a label rename.
  const update: Prisma.CustomFieldDefinitionUpdateInput = {};
  if (data.label !== undefined) update.label = data.label;
  if (data.dataType !== undefined && !existing.isCore) update.dataType = data.dataType;
  if (data.entityTypes !== undefined) update.entityTypes = data.entityTypes;
  if (data.options !== undefined) update.options = data.options as unknown as Prisma.InputJsonValue;
  if (data.aliases !== undefined) update.aliases = data.aliases as unknown as Prisma.InputJsonValue;
  if (data.unitOptions !== undefined) update.unitOptions = data.unitOptions as unknown as Prisma.InputJsonValue;
  if (data.defaultValue !== undefined) update.defaultValue = data.defaultValue as Prisma.InputJsonValue;
  if (data.isRequired !== undefined) update.isRequired = data.isRequired;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  if (data.isSearchable !== undefined) update.isSearchable = data.isSearchable;
  if (data.showInTable !== undefined) update.showInTable = data.showInTable;
  if (data.showInDetail !== undefined) update.showInDetail = data.showInDetail;
  if (data.includeInExport !== undefined) update.includeInExport = data.includeInExport;
  if (data.aiExtractable !== undefined) update.aiExtractable = data.aiExtractable;
  if (data.manualEntry !== undefined) update.manualEntry = data.manualEntry;
  if (data.displayOrder !== undefined) update.displayOrder = data.displayOrder;
  return prisma.customFieldDefinition.update({ where: { id }, data: update });
}

/** Soft-disable: hide a field without erasing historical values. Core fields can't be deleted. */
export async function disableField(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.customFieldDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError("Field not found.");
  if (existing.isCore) throw new ValidationError("Core fields cannot be deleted; disable them instead.");
  await prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } });
}

export async function reorderFields(tenantId: string, order: Array<{ id: string; displayOrder: number }>): Promise<void> {
  await prisma.$transaction(
    order.map((o) =>
      prisma.customFieldDefinition.updateMany({
        where: { id: o.id, tenantId },
        data: { displayOrder: o.displayOrder },
      }),
    ),
  );
}

export async function exportFieldConfig(tenantId: string) {
  const fields = await prisma.customFieldDefinition.findMany({ where: { tenantId }, orderBy: { displayOrder: "asc" } });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    fields: fields.map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      dataType: f.dataType,
      entityTypes: f.entityTypes,
      isCore: f.isCore,
      options: f.options,
      aliases: f.aliases,
      unitOptions: f.unitOptions,
      isRequired: f.isRequired,
      isActive: f.isActive,
      isSearchable: f.isSearchable,
      showInTable: f.showInTable,
      showInDetail: f.showInDetail,
      includeInExport: f.includeInExport,
      aiExtractable: f.aiExtractable,
      displayOrder: f.displayOrder,
    })),
  };
}

const ImportSchema = z.object({
  version: z.number(),
  fields: z.array(z.object({ fieldKey: z.string() }).passthrough()),
});

/** Import a field configuration by upserting on fieldKey (never erases data). */
export async function importFieldConfig(tenantId: string, input: unknown): Promise<number> {
  const parsed = ImportSchema.parse(input);
  let count = 0;
  for (const f of parsed.fields) {
    const key = slugify(String(f.fieldKey));
    if (!key) continue;
    const base = {
      label: String(f.label ?? key),
      dataType: (f.dataType as CustomFieldDefinition["dataType"]) ?? "TEXT",
      entityTypes: (f.entityTypes as CustomFieldDefinition["entityTypes"]) ?? "BOTH",
      isCore: Boolean(f.isCore),
      options: (f.options ?? []) as Prisma.InputJsonValue,
      aliases: (f.aliases ?? []) as Prisma.InputJsonValue,
      unitOptions: (f.unitOptions ?? []) as Prisma.InputJsonValue,
      isActive: f.isActive !== false,
      isSearchable: Boolean(f.isSearchable),
      showInTable: Boolean(f.showInTable),
      showInDetail: f.showInDetail !== false,
      includeInExport: f.includeInExport !== false,
      aiExtractable: f.aiExtractable !== false,
      displayOrder: Number(f.displayOrder ?? count),
    };
    await prisma.customFieldDefinition.upsert({
      where: { tenantId_fieldKey: { tenantId, fieldKey: key } },
      update: base,
      create: { tenantId, fieldKey: key, ...base },
    });
    count += 1;
  }
  return count;
}

export async function resetFieldsToDefault(tenantId: string): Promise<void> {
  await prisma.customFieldDefinition.deleteMany({ where: { tenantId, isCore: false } });
  await prisma.customFieldDefinition.updateMany({ where: { tenantId, isCore: true }, data: { isActive: true } });
  // Re-seed any missing core fields.
  for (const f of FIELD_CATALOGUE) {
    await prisma.customFieldDefinition.upsert({
      where: { tenantId_fieldKey: { tenantId, fieldKey: f.fieldKey } },
      update: {},
      create: { ...f, tenantId },
    });
  }
}
