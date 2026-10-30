import { z } from "zod";

const numeric = z.coerce.number().optional();

export const ListQuerySchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  propertyType: z.string().optional(),
  transactionType: z.string().optional(),
  bhk: z.coerce.number().int().optional(),
  status: z.string().optional(),
  minBudget: numeric,
  maxBudget: numeric,
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  since: z.string().optional(),
});

export const MatchQuerySchema = ListQuerySchema.extend({
  minScore: numeric,
  buyerId: z.string().optional(),
  sellerId: z.string().optional(),
});
