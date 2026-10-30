"use client";

import type {
  BuyerDTO,
  FieldDTO,
  MatchDTO,
  Paginated,
  ProcessResult,
  SellerDTO,
  StatusResponse,
} from "@/app/lib/types.ts";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const message = data?.error?.message ?? data?.message ?? `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  status: () => fetch("/api/settings/status").then((r) => handle<StatusResponse & { success: true }>(r)),

  processMessage: (text: string, hint: "auto" | "buyer" | "seller") =>
    fetch("/api/messages/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, hint, source: "manual" }),
    }).then((r) => handle<ProcessResult>(r)),

  listBuyers: (params: Record<string, unknown>) =>
    fetch(`/api/buyers${qs(params)}`).then((r) => handle<Paginated<BuyerDTO> & { success: true }>(r)),
  getBuyer: (id: string) => fetch(`/api/buyers/${id}`).then((r) => handle<{ buyer: BuyerDTO }>(r)),
  updateBuyer: (id: string, patch: Record<string, unknown>) =>
    fetch(`/api/buyers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<{ buyer: BuyerDTO }>(r)),
  deleteBuyer: (id: string) => fetch(`/api/buyers/${id}`, { method: "DELETE" }).then((r) => handle<{ id: string }>(r)),

  listSellers: (params: Record<string, unknown>) =>
    fetch(`/api/sellers${qs(params)}`).then((r) => handle<Paginated<SellerDTO> & { success: true }>(r)),
  getSeller: (id: string) => fetch(`/api/sellers/${id}`).then((r) => handle<{ seller: SellerDTO }>(r)),
  updateSeller: (id: string, patch: Record<string, unknown>) =>
    fetch(`/api/sellers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<{ seller: SellerDTO }>(r)),
  deleteSeller: (id: string) => fetch(`/api/sellers/${id}`, { method: "DELETE" }).then((r) => handle<{ id: string }>(r)),

  listMatches: (params: Record<string, unknown>) =>
    fetch(`/api/matches${qs(params)}`).then((r) => handle<Paginated<MatchDTO> & { success: true }>(r)),
  recalculate: () => fetch("/api/matches/recalculate", { method: "POST" }).then((r) => handle<{ matches: number; message: string }>(r)),
  updateMatch: (id: string, status: string) =>
    fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => handle<{ match: { id: string; status: string } }>(r)),

  listFields: (entity?: "BUYER" | "SELLER") =>
    fetch(`/api/settings/fields${qs({ entity })}`).then((r) => handle<{ fields: FieldDTO[] }>(r)),
  createField: (field: Record<string, unknown>) =>
    fetch("/api/settings/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(field),
    }).then((r) => handle<{ field: FieldDTO }>(r)),
  updateField: (id: string, patch: Record<string, unknown>) =>
    fetch(`/api/settings/fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<{ field: FieldDTO }>(r)),
  disableField: (id: string) => fetch(`/api/settings/fields/${id}`, { method: "DELETE" }).then((r) => handle<{ id: string }>(r)),

  uploadMedia: (files: File[], link: { buyerId?: string; sellerId?: string } = {}) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    if (link.buyerId) form.append("buyerId", link.buyerId);
    if (link.sellerId) form.append("sellerId", link.sellerId);
    return fetch("/api/media/upload", { method: "POST", body: form }).then((r) =>
      handle<{ media: Array<{ id: string; mediaType: string; url: string }> }>(r),
    );
  },

  deleteMedia: (id: string) => fetch(`/api/media/${id}`, { method: "DELETE" }).then((r) => handle<{ id: string }>(r)),

  exportUrl: (scope: "all" | "filtered", params: Record<string, unknown> = {}) =>
    `/api/export/xlsx${qs({ scope, ...params })}`,
};
