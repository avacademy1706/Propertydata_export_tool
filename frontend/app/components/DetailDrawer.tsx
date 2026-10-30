"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { api } from "@/app/lib/api.ts";
import { Badge, Button, Spinner, prettyEnum, useToast, verificationTone } from "@/app/components/ui.tsx";
import type { BuyerDTO, SellerDTO } from "@/app/lib/types.ts";

type RecordDTO = BuyerDTO | SellerDTO;

export function DetailDrawer({
  kind,
  id,
  onClose,
  onChanged,
}: {
  kind: "buyer" | "seller";
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [record, setRecord] = useState<RecordDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function reloadRecord() {
    const res = kind === "buyer" ? await api.getBuyer(id) : await api.getSeller(id);
    setRecord(kind === "buyer" ? (res as { buyer: BuyerDTO }).buyer : (res as { seller: SellerDTO }).seller);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await api.uploadMedia(Array.from(files), kind === "buyer" ? { buyerId: id } : { sellerId: id });
      toast("success", "Media uploaded.");
      await reloadRecord();
      onChanged();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeMedia(mediaId: string) {
    if (!confirm("Remove this attachment?")) return;
    try {
      await api.deleteMedia(mediaId);
      await reloadRecord();
      onChanged();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not remove attachment.");
    }
  }

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = kind === "buyer" ? await api.getBuyer(id) : await api.getSeller(id);
        if (!active) return;
        const rec = kind === "buyer" ? (res as { buyer: BuyerDTO }).buyer : (res as { seller: SellerDTO }).seller;
        setRecord(rec);
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Failed to load record.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [kind, id, toast]);

  function startEdit() {
    if (!record) return;
    setForm({
      contactName: record.contactName ?? "",
      phone: record.phone ?? "",
      city: record.city ?? "",
      notes: record.notes ?? "",
      status: record.status,
      verificationStatus: record.verificationStatus,
      ...(kind === "buyer"
        ? { maxBudget: (record as BuyerDTO).maxBudget ?? "" }
        : { priceAmount: (record as SellerDTO).priceAmount ?? "", location: (record as SellerDTO).location ?? "" }),
    });
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { ...form };
      if (patch.maxBudget === "") patch.maxBudget = null;
      else if (patch.maxBudget !== undefined) patch.maxBudget = Number(patch.maxBudget);
      if (patch.priceAmount === "") patch.priceAmount = null;
      else if (patch.priceAmount !== undefined) patch.priceAmount = Number(patch.priceAmount);

      if (kind === "buyer") await api.updateBuyer(id, patch);
      else await api.updateSeller(id, patch);
      toast("success", "Saved. Matches updated where relevant.");
      setEditing(false);
      onChanged();
      const res = kind === "buyer" ? await api.getBuyer(id) : await api.getSeller(id);
      setRecord(kind === "buyer" ? (res as { buyer: BuyerDTO }).buyer : (res as { seller: SellerDTO }).seller);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    setBusy(true);
    try {
      if (kind === "buyer") await api.deleteBuyer(id);
      else await api.deleteSeller(id);
      toast("success", "Record deleted.");
      onChanged();
      onClose();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  const isBuyer = kind === "buyer";
  const seller = record as SellerDTO | null;
  const buyer = record as BuyerDTO | null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className="animate-slide-in flex h-full w-full max-w-md flex-col overflow-auto border-l p-5"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {isBuyer ? "Buyer requirement" : "Property listing"}
            </p>
            <h3 className="text-lg font-semibold">{record?.contactName ?? "Untitled"}</h3>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>
            ✕
          </button>
        </div>

        {loading || !record ? (
          <Spinner label="Loading..." />
        ) : (
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{prettyEnum(record.transactionType)}</Badge>
              <Badge tone="neutral">{prettyEnum(record.propertyType)}</Badge>
              <Badge tone={verificationTone(record.verificationStatus)}>{prettyEnum(record.verificationStatus)}</Badge>
              {record.extractionConfidence !== null && (
                <Badge tone="neutral">AI {Math.round((record.extractionConfidence ?? 0) * 100)}%</Badge>
              )}
            </div>

            {record.uncertainFields.length > 0 && (
              <div className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
                Please confirm: {record.uncertainFields.join(", ")}
              </div>
            )}

            {!editing ? (
              <dl className="space-y-2 text-sm">
                <Row label="Phone" value={record.phone} />
                <Row label="Email" value={record.email} />
                <Row label="Location" value={isBuyer ? buyer!.preferredLocations.join(", ") : seller!.location} />
                <Row label="City / District" value={[record.city, record.district].filter(Boolean).join(" / ")} />
                {isBuyer ? (
                  <>
                    <Row label="Budget" value={buyer!.budgetDisplay} />
                    <Row label="Required features" value={buyer!.requiredFeatures.join(", ")} />
                    <Row label="Intended use" value={buyer!.intendedUse} />
                    <Row label="Timeline" value={buyer!.timeline} />
                  </>
                ) : (
                  <>
                    <Row label="Price" value={seller!.priceDisplay} />
                    <Row label="Area" value={seller!.areaDisplay} />
                    <Row label="Facing" value={prettyEnum(seller!.facing)} />
                    <Row label="Furnishing" value={prettyEnum(seller!.furnishingStatus)} />
                    <Row label="Features" value={seller!.features.join(", ")} />
                    {seller!.claims.length > 0 && <Row label="Claims (unverified)" value={seller!.claims.join("; ")} />}
                  </>
                )}
                <Row label="BHK" value={record.bhk?.toString()} />
                <Row label="Status" value={prettyEnum(record.status)} />
                <Row label="Notes" value={record.notes} />
                <Row label="Source" value={record.sourceMessageId ? `Message ${record.sourceMessageId.slice(0, 8)}` : "Manual"} />
                <Row label="Received" value={new Date(record.receivedAt).toLocaleString()} />
              </dl>
            ) : (
              <div className="space-y-3 text-sm">
                <Field label="Name"><input className="field" value={String(form.contactName ?? "")} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
                <Field label="Phone"><input className="field" value={String(form.phone ?? "")} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                {isBuyer ? (
                  <Field label="Max budget (₹)"><input type="number" className="field" value={String(form.maxBudget ?? "")} onChange={(e) => setForm({ ...form, maxBudget: e.target.value })} /></Field>
                ) : (
                  <>
                    <Field label="Location"><input className="field" value={String(form.location ?? "")} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                    <Field label="Price (₹)"><input type="number" className="field" value={String(form.priceAmount ?? "")} onChange={(e) => setForm({ ...form, priceAmount: e.target.value })} /></Field>
                  </>
                )}
                <Field label="City"><input className="field" value={String(form.city ?? "")} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                <Field label="Status">
                  <select className="field" value={String(form.status ?? "")} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {(isBuyer ? ["NEW", "ACTIVE", "CONTACTED", "CLOSED", "ARCHIVED"] : ["AVAILABLE", "UNDER_OFFER", "SOLD", "RENTED", "ARCHIVED"]).map((s) => (
                      <option key={s} value={s}>{prettyEnum(s)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Verification">
                  <select className="field" value={String(form.verificationStatus ?? "")} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}>
                    {["PENDING", "VERIFIED", "NEEDS_REVIEW"].map((s) => (
                      <option key={s} value={s}>{prettyEnum(s)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes"><textarea className="field" rows={3} value={String(form.notes ?? "")} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>Photos & videos</p>
                <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50" style={{ color: "var(--accent)" }}>
                  <Paperclip size={13} /> {uploading ? "Uploading..." : "Add"}
                </button>
              </div>
              {record.media && record.media.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {record.media.map((m) => (
                    <div key={m.id} className="group relative">
                      {m.mediaType === "IMAGE" ? (
                        <a href={m.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.thumbnailUrl} alt={m.caption ?? "photo"} className="h-20 w-20 rounded-lg object-cover" />
                        </a>
                      ) : (
                        <a href={m.url} target="_blank" rel="noreferrer" className="flex h-20 w-20 items-center justify-center rounded-lg border text-xs" style={{ background: "var(--surface-muted)", color: "var(--muted)" }}>
                          {prettyEnum(m.mediaType)}
                        </a>
                      )}
                      <button onClick={() => removeMedia(m.id)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full text-white group-hover:flex" style={{ background: "var(--danger)" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-soft)" }}>No attachments yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          {editing ? (
            <>
              <Button onClick={save} disabled={busy}>{busy ? <Spinner /> : "Save"}</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={startEdit}>Edit</Button>
              <Button variant="danger" onClick={remove} disabled={busy}>Delete</Button>
            </>
          )}
        </div>
      </div>

      <style>{`.field{width:100%;border:1px solid var(--border);border-radius:0.375rem;padding:0.4rem 0.6rem;background:var(--surface-muted);color:var(--foreground);}`}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}
