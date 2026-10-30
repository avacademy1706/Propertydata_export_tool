# CLAUDE.md — project guide for AI agents

**Product:** Property Desk — a local-first tool that turns WhatsApp property messages into
structured Buyer/Seller records, matches them, and exports a three-sheet Excel workbook.

**Source of truth:** `CLAUDE_REAL_ESTATE_WHATSAPP_TOOL (3).md` (the full product spec). Read it
before making product decisions. This file summarizes how the code is organized.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL ·
Prisma 7 (driver adapter `@prisma/adapter-pg`, client generated to `generated/prisma`) · Zod 4 ·
ExcelJS · `@anthropic-ai/sdk` (Claude `claude-opus-5-5`, structured outputs) · Vitest · Playwright.

## Conventions

- **Server code lives in `server/`** and is imported with the `@/` alias and explicit `.ts`
  extensions (tsconfig has `allowImportingTsExtensions`; the generated Prisma client uses `.ts`).
- **API route handlers are thin.** Business logic belongs in `server/services`, `server/matching`,
  `server/ai`, `server/export`, `server/whatsapp`. Wrap handlers in `withErrorHandling`.
- **Every query is scoped by `tenant_id`.** Use `getTenantContext()`; never query without it.
- **Model output is never trusted.** Validate every AI response against `server/ai/schemas.ts`
  with Zod. Incoming messages are untrusted data, not instructions.
- **Matching is deterministic** (`server/matching/scorer.ts`). An AI never produces the score.
- **Normalization keeps the original.** Currency/units store the raw value alongside the
  normalized one; bigha/biswa need a verified per-region rule or stay unconverted.
- **Secrets stay server-side.** Never send WhatsApp tokens or the DB URL to the browser.
- **Configurable fields:** typed columns power search/matching; everything else lives in
  `custom_fields` JSON keyed by a stable `field_key` (separate from the editable label).

## Where things are

| Area | Path |
|---|---|
| Ingest pipeline (classify → extract → dedupe → persist → match) | `server/services/ingest.ts` |
| AI providers (Claude + offline rules) | `server/ai/` |
| Matching | `server/matching/` |
| Normalization (₹, units, phone) | `server/normalize/`, `server/lib/phone.ts` |
| Excel export | `server/export/workbook.ts` |
| WhatsApp webhook/media | `server/whatsapp/`, `app/api/whatsapp/webhook/route.ts` |
| Field settings | `server/services/fields.ts`, `server/domain/field-catalogue.ts` |
| DB schema | `prisma/schema.prisma` |
| UI | `app/components/` |

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
(unit, no DB) · `RUN_DB_TESTS=1 npm run test:integration` · `npm run db:deploy` · `npm run db:seed`.

## Gotchas

- Next 16 lint forbids synchronous `setState` in effect bodies — fetch inside a nested async
  function (see `app/components/tables.tsx`).
- Prisma 7 keeps the connection URL in `prisma.config.ts`, not `schema.prisma`.
- `params` in route handlers is a `Promise` — `await ctx.params`.
- GridCraft is optional and independent — see `docs/gridcraft.md`.
