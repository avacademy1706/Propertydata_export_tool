-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'NEEDS_REVIEW', 'FAILED', 'DUPLICATE', 'HELD', 'REJECTED');

-- CreateEnum
CREATE TYPE "DetectedType" AS ENUM ('BUYER', 'SELLER', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SALE', 'RENT', 'LEASE');

-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('NEW', 'ACTIVE', 'CONTACTED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'SOLD', 'RENTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NEW', 'REVIEWED', 'CONTACTED', 'SHORTLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FieldEntity" AS ENUM ('BUYER', 'SELLER', 'BOTH');

-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL', 'CURRENCY', 'DATE', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT', 'PHONE', 'EMAIL', 'URL', 'LOCATION', 'MEASUREMENT', 'MEDIA');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'STORED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "SenderStatus" AS ENUM ('APPROVED', 'PENDING', 'BLOCKED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "external_message_id" TEXT,
    "sender_phone" TEXT,
    "sender_name" TEXT,
    "raw_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "hint" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "detected_type" "DetectedType",
    "classification_confidence" DECIMAL(4,3),
    "classification_reason" TEXT,
    "needs_review_reasons" JSONB,
    "error_message" TEXT,
    "ai_provider" TEXT,
    "ai_model" TEXT,
    "ai_raw_result" JSONB,
    "processing_summary" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_message_id" TEXT,
    "listing_sequence" INTEGER NOT NULL DEFAULT 1,
    "source_segment" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "transaction_type" "TransactionType" NOT NULL DEFAULT 'BUY',
    "property_category" TEXT,
    "property_type" TEXT,
    "preferred_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "district" TEXT,
    "city" TEXT,
    "full_address" TEXT,
    "min_budget" DECIMAL(16,2),
    "max_budget" DECIMAL(16,2),
    "budget_basis" TEXT DEFAULT 'total',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "bhk" INTEGER,
    "min_area_value" DECIMAL(14,2),
    "max_area_value" DECIMAL(14,2),
    "area_unit" TEXT,
    "area_type" TEXT,
    "front_width_value" DECIMAL(10,2),
    "front_width_unit" TEXT,
    "road_width_value" DECIMAL(10,2),
    "road_width_unit" TEXT,
    "furnishing_status" TEXT,
    "preferred_facing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_floor" TEXT,
    "timeline" TEXT,
    "intended_use" TEXT,
    "deal_source" TEXT,
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "field_provenance" JSONB NOT NULL DEFAULT '{}',
    "raw_extraction" JSONB,
    "uncertain_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BuyerStatus" NOT NULL DEFAULT 'NEW',
    "extraction_confidence" DECIMAL(4,3),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_message_id" TEXT,
    "listing_sequence" INTEGER NOT NULL DEFAULT 1,
    "source_segment" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "transaction_type" "TransactionType" NOT NULL DEFAULT 'SALE',
    "property_category" TEXT,
    "property_type" TEXT,
    "location" TEXT,
    "district" TEXT,
    "city" TEXT,
    "full_address" TEXT,
    "landmark" TEXT,
    "price_amount" DECIMAL(16,2),
    "price_basis" TEXT DEFAULT 'total',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "bhk" INTEGER,
    "bathrooms" INTEGER,
    "area_value" DECIMAL(14,2),
    "area_unit" TEXT,
    "area_type" TEXT,
    "plot_area_value" DECIMAL(14,2),
    "plot_area_unit" TEXT,
    "front_width_value" DECIMAL(10,2),
    "front_width_unit" TEXT,
    "road_width_value" DECIMAL(10,2),
    "road_width_unit" TEXT,
    "furnishing_status" TEXT,
    "facing" TEXT,
    "floor" TEXT,
    "building_configuration" TEXT,
    "property_setting" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" TEXT,
    "deal_source" TEXT,
    "google_maps_url" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "claims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "field_provenance" JSONB NOT NULL DEFAULT '{}',
    "raw_extraction" JSONB,
    "uncertain_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SellerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "extraction_confidence" DECIMAL(4,3),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "data_completeness" DECIMAL(4,3) NOT NULL,
    "insufficient_data" BOOLEAN NOT NULL DEFAULT false,
    "score_breakdown" JSONB NOT NULL,
    "match_reasons" JSONB NOT NULL,
    "mismatch_reasons" JSONB NOT NULL,
    "unknown_criteria" JSONB NOT NULL,
    "scoring_version" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'NEW',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "entity_types" "FieldEntity" NOT NULL DEFAULT 'BOTH',
    "data_type" "FieldDataType" NOT NULL DEFAULT 'TEXT',
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "unit_options" JSONB NOT NULL DEFAULT '[]',
    "default_value" JSONB,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "show_in_table" BOOLEAN NOT NULL DEFAULT false,
    "show_in_detail" BOOLEAN NOT NULL DEFAULT true,
    "include_in_export" BOOLEAN NOT NULL DEFAULT true,
    "ai_extractable" BOOLEAN NOT NULL DEFAULT true,
    "manual_entry" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "export_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_message_id" TEXT,
    "provider" "Channel" NOT NULL,
    "provider_media_id" TEXT,
    "original_filename" TEXT,
    "stored_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumbnail_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" DECIMAL(10,2),
    "checksum" TEXT NOT NULL,
    "upload_status" "UploadStatus" NOT NULL DEFAULT 'STORED',
    "ai_description" TEXT,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_links" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "seller_id" TEXT,

    CONSTRAINT "media_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_senders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "SenderStatus" NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorized_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whatsapp',
    "event_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "land_unit_conversions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "sq_ft_per_unit" DECIMAL(14,4) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "source_messages_tenant_id_content_hash_idx" ON "source_messages"("tenant_id", "content_hash");

-- CreateIndex
CREATE INDEX "source_messages_tenant_id_processing_status_idx" ON "source_messages"("tenant_id", "processing_status");

-- CreateIndex
CREATE INDEX "source_messages_tenant_id_received_at_idx" ON "source_messages"("tenant_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_messages_channel_external_message_id_key" ON "source_messages"("channel", "external_message_id");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_status_idx" ON "buyers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_city_idx" ON "buyers"("tenant_id", "city");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_property_type_idx" ON "buyers"("tenant_id", "property_type");

-- CreateIndex
CREATE INDEX "buyers_tenant_id_created_at_idx" ON "buyers"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "sellers_tenant_id_status_idx" ON "sellers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sellers_tenant_id_city_idx" ON "sellers"("tenant_id", "city");

-- CreateIndex
CREATE INDEX "sellers_tenant_id_property_type_idx" ON "sellers"("tenant_id", "property_type");

-- CreateIndex
CREATE INDEX "sellers_tenant_id_created_at_idx" ON "sellers"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "matches_tenant_id_match_score_idx" ON "matches"("tenant_id", "match_score");

-- CreateIndex
CREATE UNIQUE INDEX "matches_tenant_id_buyer_id_seller_id_key" ON "matches"("tenant_id", "buyer_id", "seller_id");

-- CreateIndex
CREATE INDEX "custom_field_definitions_tenant_id_display_order_idx" ON "custom_field_definitions"("tenant_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_field_key_key" ON "custom_field_definitions"("tenant_id", "field_key");

-- CreateIndex
CREATE INDEX "media_attachments_tenant_id_checksum_idx" ON "media_attachments"("tenant_id", "checksum");

-- CreateIndex
CREATE INDEX "media_attachments_tenant_id_source_message_id_idx" ON "media_attachments"("tenant_id", "source_message_id");

-- CreateIndex
CREATE INDEX "media_links_buyer_id_idx" ON "media_links"("buyer_id");

-- CreateIndex
CREATE INDEX "media_links_seller_id_idx" ON "media_links"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_links_media_id_buyer_id_seller_id_key" ON "media_links"("media_id", "buyer_id", "seller_id");

-- CreateIndex
CREATE INDEX "authorized_senders_tenant_id_idx" ON "authorized_senders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_senders_phone_e164_key" ON "authorized_senders"("phone_e164");

-- CreateIndex
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_key_key" ON "webhook_events"("provider", "event_key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenant_id_key_key" ON "settings"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "land_unit_conversions_tenant_id_unit_region_key" ON "land_unit_conversions"("tenant_id", "unit", "region");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "source_messages" ADD CONSTRAINT "source_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "source_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "source_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "source_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_senders" ADD CONSTRAINT "authorized_senders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_unit_conversions" ADD CONSTRAINT "land_unit_conversions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

