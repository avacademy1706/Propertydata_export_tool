"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Columns3, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  MoreVertical, MessageCircle, Newspaper, Link2 as RefIcon, User as ManualIcon, Image as ImageIcon, Check, Plus, X, Trash2,
} from "lucide-react";
import { api } from "@/app/lib/api.ts";
import { Badge, Spinner, prettyEnum, useDebounced, useToast, verificationTone } from "@/app/components/ui.tsx";
import type { BuyerDTO, MatchDTO, SellerDTO } from "@/app/lib/types.ts";

const PAGE_SIZE = 8;

type AnyRow = BuyerDTO | SellerDTO;

// ---------------------------------------------------------------------------
// Shared cells / controls
// ---------------------------------------------------------------------------

function SourceCell({ source }: { source: string }) {
  const s = source.toLowerCase();
  let Icon = ManualIcon;
  let color = "var(--muted)";
  if (s === "whatsapp") { Icon = MessageCircle; color = "var(--whatsapp)"; }
  else if (s === "newspaper") { Icon = Newspaper; color = "var(--danger)"; }
  else if (s === "reference") { Icon = RefIcon; color = "var(--info)"; }
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
      <Icon size={15} style={{ color }} aria-hidden="true" />
      {source}
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function SortHeader({ label, field, sort, order, onSort, sortable = true }: {
  label: string; field?: string; sort: string; order: "asc" | "desc"; onSort: (f: string) => void; sortable?: boolean;
}) {
  const active = sortable && field && sort === field;
  const ariaSort = active ? (order === "asc" ? "ascending" : "descending") : sortable && field ? "none" : undefined;
  return (
    <th scope="col" aria-sort={ariaSort} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
      {sortable && field ? (
        <button onClick={() => onSort(field)} aria-label={`Sort by ${label}`} className="inline-flex items-center gap-1 hover:opacity-80">
          {label}
          {active ? (order === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <ArrowUpDown size={12} aria-hidden="true" style={{ opacity: 0.5 }} />}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: number[] = [];
  const windowSize = 5;
  let start = Math.max(1, page - 2);
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  for (let i = start; i <= end; i++) nums.push(i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
      <span>Showing {from}–{to} of {total} records</span>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border p-2 disabled:opacity-40" style={{ background: "var(--surface)" }}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {start > 1 && <span className="px-1">…</span>}
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
            className="min-w-9 rounded-md px-2.5 py-2 font-medium"
            style={{ background: n === page ? "var(--accent)" : "var(--surface)", color: n === page ? "#fff" : "var(--muted)", border: n === page ? "none" : "1px solid var(--border-strong)" }}
          >
            {n}
          </button>
        ))}
        {end < pages && <span className="px-1">…</span>}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-md border p-2 disabled:opacity-40" style={{ background: "var(--surface)" }}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function RowMenu({ onOpen, onDelete }: { onOpen: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-label="Row actions" aria-haspopup="menu" aria-expanded={open} className="rounded-md p-2 hover:bg-[var(--surface-muted)]" style={{ color: "var(--muted)" }}>
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border shadow-lg" style={{ background: "var(--surface)" }}>
          <button role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen(); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]">
            View details
          </button>
          <button role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]" style={{ color: "var(--danger)" }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Toolbar({ search, setSearch, children }: { search: string; setSearch: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-40 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-soft)" }} aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search location, budget, property type..."
          aria-label="Search records"
          className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border-strong)", color: "var(--foreground)" }}
        />
      </div>
      {children}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Column registries (every parameter is a toggleable column)
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  label: string;
  sortField?: string;
  default: boolean;
  render: (row: AnyRow) => React.ReactNode;
  custom?: boolean; // admin-added custom field (removable)
  fieldId?: string; // definition id, for removal
}

const joinList = (v: string[] | undefined) => (v && v.length ? v.join(", ") : "—");

const buyerColumns: ColumnDef[] = [
  { key: "date", label: "Date", sortField: "createdAt", default: true, render: (r) => <span style={{ color: "var(--muted)" }}>{fmtDate(r.receivedAt)}</span> },
  {
    key: "name", label: "Name", sortField: "contactName", default: true,
    render: (r) => (
      <span className="inline-flex items-center gap-1.5 font-medium">
        {r.contactName ?? "—"}
        {r.mediaCount > 0 && <ImageIcon size={13} style={{ color: "var(--muted-soft)" }} aria-label="has media" />}
      </span>
    ),
  },
  { key: "phone", label: "Phone", default: true, render: (r) => <span className="tabular" style={{ color: "var(--muted)" }}>{r.phone ?? "—"}</span> },
  { key: "email", label: "Email", default: false, render: (r) => r.email ?? "—" },
  { key: "transaction", label: "Transaction", default: false, render: (r) => prettyEnum(r.transactionType) },
  { key: "category", label: "Category", default: false, render: (r) => prettyEnum(r.propertyCategory) },
  { key: "propertyType", label: "Property Type", default: true, render: (r) => prettyEnum(r.propertyType) },
  { key: "location", label: "Location", sortField: "city", default: true, render: (r) => [(r as BuyerDTO).preferredLocations?.[0], r.city].filter(Boolean).join(", ") || "—" },
  { key: "district", label: "District", default: false, render: (r) => r.district ?? "—" },
  { key: "city", label: "City", default: false, render: (r) => r.city ?? "—" },
  { key: "budget", label: "Budget", sortField: "maxBudget", default: true, render: (r) => <span className="font-medium">{(r as BuyerDTO).budgetDisplay || "—"}</span> },
  { key: "rateBasis", label: "Rate Basis", default: false, render: (r) => prettyEnum((r as BuyerDTO).budgetBasis) },
  { key: "area", label: "Area", default: false, render: (r) => (r as BuyerDTO).areaDisplay || "—" },
  { key: "areaType", label: "Area Type", default: false, render: (r) => prettyEnum(r.areaType) },
  { key: "bhk", label: "BHK", default: false, render: (r) => r.bhk ?? "—" },
  { key: "facing", label: "Facing", default: false, render: (r) => joinList((r as BuyerDTO).preferredFacing?.map(prettyEnum)) },
  { key: "features", label: "Features", default: false, render: (r) => joinList((r as BuyerDTO).requiredFeatures) },
  { key: "intendedUse", label: "Intended Use", default: false, render: (r) => (r as BuyerDTO).intendedUse ?? "—" },
  { key: "timeline", label: "Timeline", default: false, render: (r) => (r as BuyerDTO).timeline ?? "—" },
  { key: "source", label: "Source", default: true, render: (r) => <SourceCell source={r.source} /> },
  { key: "status", label: "Status", default: true, render: () => <Badge tone="success">Buyer</Badge> },
  { key: "verification", label: "Verification", default: false, render: (r) => <Badge tone={verificationTone(r.verificationStatus)}>{prettyEnum(r.verificationStatus)}</Badge> },
  { key: "notes", label: "Notes", default: false, render: (r) => <span className="line-clamp-2 max-w-60">{r.notes ?? "—"}</span> },
];

const sellerColumns: ColumnDef[] = [
  { key: "date", label: "Date", sortField: "createdAt", default: true, render: (r) => <span style={{ color: "var(--muted)" }}>{fmtDate(r.receivedAt)}</span> },
  {
    key: "name", label: "Name", sortField: "contactName", default: true,
    render: (r) => (
      <span className="inline-flex items-center gap-1.5 font-medium">
        {r.contactName ?? "—"}
        {r.mediaCount > 0 && <ImageIcon size={13} style={{ color: "var(--muted-soft)" }} aria-label="has media" />}
      </span>
    ),
  },
  { key: "phone", label: "Phone", default: true, render: (r) => <span className="tabular" style={{ color: "var(--muted)" }}>{r.phone ?? "—"}</span> },
  { key: "email", label: "Email", default: false, render: (r) => r.email ?? "—" },
  { key: "transaction", label: "Transaction", default: false, render: (r) => prettyEnum(r.transactionType) },
  { key: "category", label: "Category", default: false, render: (r) => prettyEnum(r.propertyCategory) },
  { key: "propertyType", label: "Property Type", default: true, render: (r) => prettyEnum(r.propertyType) },
  { key: "location", label: "Location", sortField: "city", default: true, render: (r) => [(r as SellerDTO).location, r.city].filter(Boolean).join(", ") || "—" },
  { key: "landmark", label: "Landmark", default: false, render: (r) => (r as SellerDTO).landmark ?? "—" },
  { key: "district", label: "District", default: false, render: (r) => r.district ?? "—" },
  { key: "city", label: "City", default: false, render: (r) => r.city ?? "—" },
  { key: "price", label: "Price", sortField: "priceAmount", default: true, render: (r) => <span className="font-medium">{(r as SellerDTO).priceDisplay || "—"}</span> },
  { key: "rateBasis", label: "Rate Basis", default: false, render: (r) => prettyEnum((r as SellerDTO).priceBasis) },
  { key: "area", label: "Area", default: false, render: (r) => (r as SellerDTO).areaDisplay || "—" },
  { key: "areaType", label: "Area Type", default: false, render: (r) => prettyEnum(r.areaType) },
  { key: "plotArea", label: "Plot Area", default: false, render: (r) => { const v = (r as SellerDTO).plotAreaValue; return v !== null ? `${v}` : "—"; } },
  { key: "bhk", label: "BHK", default: false, render: (r) => r.bhk ?? "—" },
  { key: "bathrooms", label: "Bathrooms", default: false, render: (r) => (r as SellerDTO).bathrooms ?? "—" },
  { key: "facing", label: "Facing", default: false, render: (r) => prettyEnum((r as SellerDTO).facing) },
  { key: "furnishing", label: "Furnishing", default: false, render: (r) => prettyEnum((r as SellerDTO).furnishingStatus) },
  { key: "buildingConfig", label: "Building Config", default: false, render: (r) => prettyEnum((r as SellerDTO).buildingConfiguration) },
  { key: "floor", label: "Floor", default: false, render: (r) => (r as SellerDTO).floor ?? "—" },
  { key: "propertySetting", label: "Property Setting", default: false, render: (r) => prettyEnum((r as SellerDTO).propertySetting) },
  { key: "features", label: "Features", default: false, render: (r) => joinList((r as SellerDTO).features) },
  { key: "dealSource", label: "Deal Source", default: false, render: (r) => prettyEnum((r as SellerDTO).dealSource) },
  { key: "googleLocation", label: "Google Location", default: false, render: (r) => { const u = (r as SellerDTO).googleMapsUrl; return u ? <a href={u} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Map</a> : "—"; } },
  { key: "availability", label: "Availability", default: false, render: (r) => (r as SellerDTO).availability ?? prettyEnum(r.status) },
  { key: "source", label: "Source", default: true, render: (r) => <SourceCell source={r.source} /> },
  { key: "status", label: "Status", default: true, render: () => <Badge tone="warning">Seller</Badge> },
  { key: "verification", label: "Verification", default: false, render: (r) => <Badge tone={verificationTone(r.verificationStatus)}>{prettyEnum(r.verificationStatus)}</Badge> },
  { key: "notes", label: "Notes", default: false, render: (r) => <span className="line-clamp-2 max-w-60">{r.notes ?? "—"}</span> },
];

function loadVisible(kind: "buyer" | "seller", columns: ColumnDef[]): string[] {
  const fallback = columns.filter((c) => c.default).map((c) => c.key);
  try {
    const raw = localStorage.getItem(`pd:cols:${kind}`);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      // Keep every saved key (including custom "cf:*" ones that load asynchronously).
      if (Array.isArray(arr) && arr.length && arr.every((x) => typeof x === "string")) return arr as string[];
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function ColumnsPopover({ columns, visible, onToggle, onReset, onCreateField, onRemoveField }: {
  columns: ColumnDef[]; visible: string[]; onToggle: (key: string) => void; onReset: () => void; onCreateField: (label: string) => Promise<void>; onRemoveField: (col: ColumnDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function submit() {
    const name = label.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await onCreateField(name);
      setLabel("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium" style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}>
        <Columns3 size={15} aria-hidden="true" /> Columns <Badge tone="neutral">{visible.length}</Badge>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg sm:left-auto sm:right-0" style={{ background: "var(--surface)" }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Show columns</span>
            <button onClick={onReset} className="text-xs underline" style={{ color: "var(--accent)" }}>Reset</button>
          </div>
          {adding ? (
            <div className="flex items-center gap-1.5 border-b px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); if (e.key === "Escape") { setAdding(false); setLabel(""); } }}
                placeholder="New field name"
                aria-label="New field name"
                className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--surface-muted)", borderColor: "var(--border-strong)", color: "var(--foreground)" }}
              />
              <button onClick={() => void submit()} disabled={saving || !label.trim()} aria-label="Save field" className="flex h-8 w-8 items-center justify-center rounded-md text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {saving ? <Spinner /> : <Check size={15} aria-hidden="true" />}
              </button>
              <button onClick={() => { setAdding(false); setLabel(""); }} aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: "var(--muted)" }}>
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: "var(--accent-soft)" }}><Plus size={14} aria-hidden="true" /></span>
              Add field
            </button>
          )}
          <div className="scroll-area max-h-72 overflow-y-auto p-1.5">
            {columns.map((c) => {
              const checked = visible.includes(c.key);
              return (
                <div key={c.key} className="group flex items-center rounded-md hover:bg-[var(--surface-muted)]">
                  <button
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => onToggle(c.key)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={{ background: checked ? "var(--accent)" : "transparent", borderColor: checked ? "var(--accent)" : "var(--border-strong)" }}>
                      {checked && <Check size={12} color="#fff" aria-hidden="true" />}
                    </span>
                    <span className="truncate">{c.label}</span>
                    {c.custom && <Badge tone="neutral">custom</Badge>}
                  </button>
                  {c.custom && (
                    <button
                      onClick={() => onRemoveField(c)}
                      aria-label={`Remove ${c.label}`}
                      title="Remove field"
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-60 hover:opacity-100"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Records table (buyers / sellers) with dynamic columns
// ---------------------------------------------------------------------------

export function RecordsTable({ kind, refreshKey, onOpen, onChanged, since }: {
  kind: "buyer" | "seller"; refreshKey: number; onOpen: (id: string) => void; onChanged: () => void; since?: string;
}) {
  const baseColumns = kind === "buyer" ? buyerColumns : sellerColumns;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<string[]>(() => baseColumns.filter((c) => c.default).map((c) => c.key));
  const [customCols, setCustomCols] = useState<ColumnDef[]>([]);
  const [fieldsReload, setFieldsReload] = useState(0);
  const debounced = useDebounced(search);
  const toast = useToast();

  const columns = [...baseColumns, ...customCols];

  // Load saved column choice on mount (client only).
  useEffect(() => {
    const applySaved = () => setVisible(loadVisible(kind, baseColumns));
    applySaved();
  }, [kind, baseColumns]);

  // Load admin-defined custom fields and render them as toggleable columns.
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await api.listFields(kind === "buyer" ? "BUYER" : "SELLER");
        if (!active) return;
        const defs: ColumnDef[] = res.fields
          .filter((f) => !f.isCore && f.isActive)
          .map((f) => ({
            key: `cf:${f.fieldKey}`,
            label: f.label,
            default: false,
            custom: true,
            fieldId: f.id,
            render: (r: AnyRow) => {
              const v = (r.customFields as Record<string, unknown> | undefined)?.[f.fieldKey];
              return v === null || v === undefined || v === "" ? "—" : String(v);
            },
          }));
        setCustomCols(defs);
      } catch {
        /* ignore */
      }
    };
    void run();
    return () => { active = false; };
  }, [kind, fieldsReload]);

  function persist(next: string[]) {
    setVisible(next);
    try { localStorage.setItem(`pd:cols:${kind}`, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function toggleColumn(key: string) {
    persist(visible.includes(key) ? visible.filter((k) => k !== key) : columns.filter((c) => visible.includes(c.key) || c.key === key).map((c) => c.key));
  }
  function resetColumns() {
    persist(baseColumns.filter((c) => c.default).map((c) => c.key));
  }

  async function createField(label: string) {
    try {
      const res = await api.createField({
        label,
        dataType: "TEXT",
        entityTypes: kind === "buyer" ? "BUYER" : "SELLER",
        showInTable: true,
        isSearchable: true,
        includeInExport: true,
      });
      const key = `cf:${res.field.fieldKey}`;
      setFieldsReload((x) => x + 1);
      persist([...visible, key]);
      toast("success", `Field "${label}" added.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not add field.");
    }
  }

  async function removeField(col: ColumnDef) {
    if (!col.fieldId) return;
    if (!confirm(`Remove the field "${col.label}"? The column is removed; any existing values are kept in the database.`)) return;
    try {
      await api.disableField(col.fieldId);
      setFieldsReload((x) => x + 1);
      persist(visible.filter((k) => k !== col.key));
      toast("success", `Field "${col.label}" removed.`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not remove field.");
    }
  }

  const changeSearch = (v: string) => { setSearch(v); setPage(1); };

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const params = { search: debounced, sort, order, page, pageSize: PAGE_SIZE, since };
        const res = kind === "buyer" ? await api.listBuyers(params) : await api.listSellers(params);
        if (!active) return;
        setRows(res.items);
        setTotal(res.total);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [debounced, sort, order, page, kind, refreshKey, since]);

  function onSort(field: string) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(field); setOrder("asc"); }
  }

  async function del(id: string) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    try {
      if (kind === "buyer") await api.deleteBuyer(id);
      else await api.deleteSeller(id);
      toast("success", "Record deleted.");
      onChanged();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const shown = columns.filter((c) => visible.includes(c.key));
  const colCount = shown.length + 1;

  return (
    <div className="elevated rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold capitalize">{kind === "buyer" ? "Buyers" : "Sellers"}</h2>
        <Toolbar search={search} setSearch={changeSearch}>
          <ColumnsPopover columns={columns} visible={visible} onToggle={toggleColumn} onReset={resetColumns} onCreateField={createField} onRemoveField={removeField} />
        </Toolbar>
      </div>
      <div className="scroll-area overflow-x-auto">
        <table className="w-full border-collapse">
          <thead style={{ background: "var(--surface-muted)" }}>
            <tr>
              {shown.map((c) => (
                <SortHeader key={c.key} label={c.label} field={c.sortField} sort={sort} order={order} onSort={onSort} sortable={!!c.sortField} />
              ))}
              <th scope="col" className="px-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="skeleton h-4" style={{ width: j === 1 ? "80%" : "55%" }} /></td>
                  ))}
                </tr>
              ))
            ) : shown.length === 0 ? (
              <tr><td className="px-4 py-14 text-center text-sm" style={{ color: "var(--muted)" }}>Select at least one column to display.</td></tr>
            ) : rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-14 text-center text-sm" style={{ color: "var(--muted)" }}>
                  {kind === "buyer" ? "No buyer requirements yet. Use the WhatsApp Assistant to add one." : "No property listings yet. Use the WhatsApp Assistant to add one."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(r.id); }} aria-label={`Open ${r.contactName ?? "record"} details`} className="cursor-pointer border-t transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)" }}>
                  {shown.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-3.5 text-sm">{c.render(r)}</td>
                  ))}
                  <td className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <RowMenu onOpen={() => onOpen(r.id)} onDelete={() => del(r.id)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matching table
// ---------------------------------------------------------------------------

function bandTone(band: string): "success" | "accent" | "warning" | "neutral" {
  if (band === "excellent") return "success";
  if (band === "strong") return "accent";
  if (band === "possible") return "warning";
  return "neutral";
}

export function MatchingTable({ refreshKey }: { refreshKey: number }) {
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MatchDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<MatchDTO | null>(null);
  const debounced = useDebounced(search);

  const changeSearch = (v: string) => { setSearch(v); setPage(1); };
  const changeMin = (v: string) => { setMinScore(v); setPage(1); };

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.listMatches({ search: debounced, minScore: minScore || undefined, page, pageSize: PAGE_SIZE });
        if (!active) return;
        setRows(res.items);
        setTotal(res.total);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [debounced, minScore, page, refreshKey]);

  return (
    <div className="elevated rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold">Matching</h2>
        <Toolbar search={search} setSearch={changeSearch}>
          <select value={minScore} onChange={(e) => changeMin(e.target.value)} aria-label="Minimum match score" className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}>
            <option value="">All scores</option>
            <option value="90">Excellent (90+)</option>
            <option value="75">Strong (75+)</option>
            <option value="60">Possible (60+)</option>
          </select>
        </Toolbar>
      </div>
      <div className="scroll-area overflow-x-auto">
        <table className="w-full border-collapse">
          <thead style={{ background: "var(--surface-muted)" }}>
            <tr>
              {["Match", "Buyer", "Property", "Price", "Why", "Status"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="skeleton h-4" style={{ width: "60%" }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No matches yet. Add buyers and sellers and matches appear automatically.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} onClick={() => setOpen(m)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpen(m); }} aria-label="Open match breakdown" className="cursor-pointer border-t transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3.5"><Badge tone={bandTone(m.band)}>{m.insufficientData ? "Insufficient" : `${Math.round(m.matchScore)}%`}</Badge></td>
                  <td className="px-4 py-3.5 text-sm font-medium">{m.buyerName ?? m.buyerPhone ?? m.buyerId.slice(0, 8)}</td>
                  <td className="px-4 py-3.5 text-sm">{prettyEnum(m.propertyType)} · {m.sellerLocation ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{m.priceDisplay || "—"}</td>
                  <td className="max-w-80 truncate px-4 py-3.5 text-sm" style={{ color: "var(--muted)" }} title={m.matchReasons.join(" · ")}>{m.matchReasons.slice(0, 2).join(" · ") || "—"}</td>
                  <td className="px-4 py-3.5"><Badge tone="neutral">{prettyEnum(m.status)}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </div>
      {open && <MatchBreakdown match={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MatchBreakdown({ match, onClose }: { match: MatchDTO; onClose: () => void }) {
  const weights: Array<[string, string]> = [
    ["location", "Location"], ["budget", "Budget"], ["propertyType", "Property type"],
    ["bhk", "BHK"], ["area", "Area"], ["features", "Features"], ["facing", "Facing"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div className="animate-slide-in max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border p-5" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Match breakdown</h3>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="mb-4 flex items-center gap-2">
          <Badge tone={bandTone(match.band)}>{match.insufficientData ? "Insufficient data" : `${Math.round(match.matchScore)}% match`}</Badge>
          <span className="text-xs" style={{ color: "var(--muted)" }}>data completeness {Math.round(match.dataCompleteness * 100)}%</span>
        </div>
        <div className="space-y-1.5">
          {weights.map(([key, label]) => {
            const points = match.scoreBreakdown[key] ?? 0;
            const unknown = match.unknownCriteria.includes(key);
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="tabular" style={{ color: unknown ? "var(--muted)" : "var(--foreground)" }}>{unknown ? "not comparable" : `${points.toFixed(1)} pts`}</span>
              </div>
            );
          })}
        </div>
        {match.matchReasons.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase" style={{ color: "var(--success)" }}>Why it matches</p>
            <ul className="list-inside list-disc text-sm">{match.matchReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
        {match.mismatchReasons.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase" style={{ color: "var(--warning)" }}>Caveats</p>
            <ul className="list-inside list-disc text-sm">{match.mismatchReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
