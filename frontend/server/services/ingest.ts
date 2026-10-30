import type { Prisma, DetectedType } from "@/generated/prisma/client.ts";
import { prisma } from "@/server/db/client.ts";
import { getAiProvider } from "@/server/ai/index.ts";
import { ExtractionResultSchema, type ExtractedRecord } from "@/server/ai/schemas.ts";
import { mapBuyer, mapSeller } from "@/server/services/record-mapper.ts";
import { recalculateForBuyer, recalculateForSeller } from "@/server/matching/engine.ts";
import type { RegionRule } from "@/server/normalize/units.ts";
import { preprocessMessage } from "@/server/lib/text.ts";
import { contentHash } from "@/server/lib/hash.ts";
import { ValidationError } from "@/server/lib/errors.ts";
import { logger } from "@/server/lib/logger.ts";

export interface IngestInput {
  tenantId: string;
  text: string;
  hint?: "auto" | "buyer" | "seller";
  channel: "WHATSAPP" | "MANUAL";
  externalMessageId?: string | null;
  senderPhone?: string | null;
  senderName?: string | null;
  actor?: string;
}

export interface CreatedRecordSummary {
  id: string;
  type: "buyer" | "seller";
  sourceSegment: string | null;
}

export interface IngestResult {
  success: boolean;
  duplicate: boolean;
  messageId: string;
  detectedType: "buyer" | "seller" | "both" | "unknown";
  confidence: number;
  status: string;
  createdRecords: CreatedRecordSummary[];
  needsReview: boolean;
  reviewReasons: string[];
  summary: string;
  message: string;
}

// Confidence thresholds (configurable defaults).
const AUTO_ROUTE = 0.85;
const REVIEW_FLOOR = 0.6;

export async function processMessage(input: IngestInput): Promise<IngestResult> {
  const text = preprocessMessage(input.text ?? "");
  if (!text) throw new ValidationError("Message text is empty.");

  const hash = contentHash(text);
  const hint = input.hint ?? "auto";

  // --- Idempotency / duplicate detection -------------------------------
  if (input.externalMessageId) {
    const existing = await prisma.sourceMessage.findUnique({
      where: { channel_externalMessageId: { channel: input.channel, externalMessageId: input.externalMessageId } },
    });
    if (existing) {
      return duplicateResult(existing.id, existing.detectedType ?? "unknown", "This message was already processed.");
    }
  }
  const dupe = await prisma.sourceMessage.findFirst({
    where: { tenantId: input.tenantId, contentHash: hash, processingStatus: { in: ["PROCESSED", "NEEDS_REVIEW"] } },
    orderBy: { createdAt: "desc" },
  });
  if (dupe) {
    return duplicateResult(dupe.id, dupe.detectedType ?? "unknown", "An identical message already exists.");
  }

  // --- Create the source message (PROCESSING) --------------------------
  const sourceMessage = await prisma.sourceMessage.create({
    data: {
      tenantId: input.tenantId,
      channel: input.channel,
      externalMessageId: input.externalMessageId ?? null,
      senderPhone: input.senderPhone ?? null,
      senderName: input.senderName ?? null,
      rawText: input.text,
      contentHash: hash,
      hint,
      processingStatus: "PROCESSING",
    },
  });

  // --- AI classification + extraction ----------------------------------
  const provider = getAiProvider();
  let extraction;
  try {
    const raw = await provider.extract({ text, hint });
    extraction = ExtractionResultSchema.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.sourceMessage.update({
      where: { id: sourceMessage.id },
      data: { processingStatus: "FAILED", errorMessage: message, aiProvider: provider.name },
    });
    logger.error("extraction failed", { messageId: sourceMessage.id, provider: provider.name });
    return {
      success: false,
      duplicate: false,
      messageId: sourceMessage.id,
      detectedType: "unknown",
      confidence: 0,
      status: "FAILED",
      createdRecords: [],
      needsReview: true,
      reviewReasons: [message],
      summary: "Extraction failed",
      message: "We couldn't read this message automatically. It is saved for review.",
    };
  }

  const detectedType = extraction.classification;
  const detectedTypeEnum = toDetectedTypeEnum(detectedType);
  const confidence = extraction.confidence;
  const regionRules = await loadRegionRules(input.tenantId);

  // Filter records to those we actually keep.
  const keepRecords = selectRecords(extraction.records, detectedType);

  // Low confidence or unknown: keep for review, create no records.
  const forceReview = detectedType === "unknown" || confidence < REVIEW_FLOOR || keepRecords.length === 0;

  if (forceReview) {
    await prisma.sourceMessage.update({
      where: { id: sourceMessage.id },
      data: {
        processingStatus: "NEEDS_REVIEW",
        detectedType: detectedTypeEnum,
        classificationConfidence: confidence,
        classificationReason: extraction.review_reasons.join("; ") || "Needs human review.",
        needsReviewReasons: extraction.review_reasons as unknown as Prisma.InputJsonValue,
        aiProvider: provider.name,
        aiRawResult: extraction as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
        processingSummary: "0 records created · needs review",
      },
    });
    return {
      success: true,
      duplicate: false,
      messageId: sourceMessage.id,
      detectedType,
      confidence,
      status: "NEEDS_REVIEW",
      createdRecords: [],
      needsReview: true,
      reviewReasons: extraction.review_reasons,
      summary: "1 message received · needs review",
      message:
        detectedType === "unknown"
          ? "We could not identify this as a buyer requirement or property listing. It is saved for review."
          : "A few details need confirmation. The message is saved for review.",
    };
  }

  // --- Persist records in a transaction --------------------------------
  const weak = confidence < AUTO_ROUTE;
  const created: CreatedRecordSummary[] = [];

  await prisma.$transaction(async (tx) => {
    let sequence = 1;
    for (const record of keepRecords) {
      const opts = {
        tenantId: input.tenantId,
        sourceMessageId: sourceMessage.id,
        listingSequence: sequence,
        regionRules,
      };
      if (record.record_type === "buyer") {
        const buyer = await tx.buyer.create({ data: mapBuyer(record, opts) });
        if (weak || record.uncertain_fields.length > 0) {
          await tx.buyer.update({ where: { id: buyer.id }, data: { verificationStatus: "NEEDS_REVIEW" } });
        }
        created.push({ id: buyer.id, type: "buyer", sourceSegment: record.source_segment });
      } else {
        const seller = await tx.seller.create({ data: mapSeller(record, opts) });
        if (weak || record.uncertain_fields.length > 0) {
          await tx.seller.update({ where: { id: seller.id }, data: { verificationStatus: "NEEDS_REVIEW" } });
        }
        created.push({ id: seller.id, type: "seller", sourceSegment: record.source_segment });
      }
      sequence += 1;
    }

    const buyerCount = created.filter((r) => r.type === "buyer").length;
    const sellerCount = created.filter((r) => r.type === "seller").length;
    const summary = buildSummary(buyerCount, sellerCount);

    await tx.sourceMessage.update({
      where: { id: sourceMessage.id },
      data: {
        processingStatus: extraction.needs_review || weak ? "NEEDS_REVIEW" : "PROCESSED",
        detectedType: detectedTypeEnum,
        classificationConfidence: confidence,
        classificationReason: "",
        aiProvider: provider.name,
        aiRawResult: extraction as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
        processingSummary: summary,
      },
    });

    for (const r of created) {
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          entityType: r.type,
          entityId: r.id,
          action: "create",
          actor: input.actor ?? (input.channel === "WHATSAPP" ? "whatsapp" : "manual"),
          changes: { sourceMessageId: sourceMessage.id } as Prisma.InputJsonValue,
        },
      });
    }
  });

  // --- Recalculate matches (after commit) ------------------------------
  for (const r of created) {
    if (r.type === "buyer") await recalculateForBuyer(input.tenantId, r.id);
    else await recalculateForSeller(input.tenantId, r.id);
  }

  const buyerCount = created.filter((r) => r.type === "buyer").length;
  const sellerCount = created.filter((r) => r.type === "seller").length;
  const summary = buildSummary(buyerCount, sellerCount);

  return {
    success: true,
    duplicate: false,
    messageId: sourceMessage.id,
    detectedType,
    confidence,
    status: extraction.needs_review || weak ? "NEEDS_REVIEW" : "PROCESSED",
    createdRecords: created,
    needsReview: extraction.needs_review || weak,
    reviewReasons: extraction.review_reasons,
    summary,
    message: userMessage(buyerCount, sellerCount, weak),
  };
}

function toDetectedTypeEnum(value: "buyer" | "seller" | "both" | "unknown"): DetectedType {
  return value.toUpperCase() as DetectedType;
}

function selectRecords(records: ExtractedRecord[], detectedType: string): ExtractedRecord[] {
  if (detectedType === "unknown") return [];
  if (detectedType === "buyer") return records.filter((r) => r.record_type === "buyer");
  if (detectedType === "seller") return records.filter((r) => r.record_type === "seller");
  return records; // both
}

async function loadRegionRules(tenantId: string): Promise<RegionRule[]> {
  const rows = await prisma.landUnitConversion.findMany({ where: { tenantId, verified: true } });
  return rows.map((r) => ({
    unit: r.unit,
    region: r.region,
    sqFtPerUnit: Number(r.sqFtPerUnit.toString()),
  }));
}

function duplicateResult(messageId: string, detectedType: string, message: string): IngestResult {
  return {
    success: true,
    duplicate: true,
    messageId,
    detectedType: detectedType.toLowerCase() as IngestResult["detectedType"],
    confidence: 0,
    status: "DUPLICATE",
    createdRecords: [],
    needsReview: false,
    reviewReasons: [],
    summary: "Duplicate message ignored",
    message,
  };
}

function buildSummary(buyerCount: number, sellerCount: number): string {
  const parts: string[] = ["1 message processed"];
  if (buyerCount) parts.push(`${buyerCount} buyer requirement${buyerCount > 1 ? "s" : ""} created`);
  if (sellerCount) parts.push(`${sellerCount} property listing${sellerCount > 1 ? "s" : ""} created`);
  return parts.join(" · ");
}

function userMessage(buyerCount: number, sellerCount: number, weak: boolean): string {
  const total = buyerCount + sellerCount;
  const base =
    total === 0
      ? "Message received."
      : buyerCount && sellerCount
        ? `Added ${buyerCount} buyer and ${sellerCount} property record(s).`
        : buyerCount
          ? `Buyer requirement${buyerCount > 1 ? "s" : ""} added successfully.`
          : `Property listing${sellerCount > 1 ? "s" : ""} added successfully.`;
  return weak ? `${base} Some details need confirmation.` : base;
}
