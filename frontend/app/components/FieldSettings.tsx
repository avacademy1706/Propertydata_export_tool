"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/app/lib/api.ts";
import { Badge, Button, Spinner, prettyEnum, triggerDownload, useToast } from "@/app/components/ui.tsx";
import type { FieldDTO } from "@/app/lib/types.ts";

const DATA_TYPES = [
  "TEXT", "LONG_TEXT", "NUMBER", "DECIMAL", "CURRENCY", "DATE", "BOOLEAN",
  "SINGLE_SELECT", "MULTI_SELECT", "PHONE", "EMAIL", "URL", "LOCATION", "MEASUREMENT", "MEDIA",
];

export function FieldSettings({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState({ label: "", dataType: "TEXT", entityTypes: "BOTH", options: "" });
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await api.listFields();
        if (active) setFields(res.fields);
      } catch (err) {
        if (active) toast("error", err instanceof Error ? err.message : "Failed to load fields.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [reloadKey, toast]);

  async function toggle(field: FieldDTO, key: "isActive" | "showInTable" | "includeInExport" | "isSearchable" | "aiExtractable") {
    try {
      await api.updateField(field.id, { [key]: !field[key] });
      setFields((fs) => fs.map((f) => (f.id === field.id ? { ...f, [key]: !f[key] } : f)));
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function addField() {
    if (!newField.label.trim()) {
      toast("warning", "Enter a field label.");
      return;
    }
    try {
      await api.createField({
        label: newField.label,
        dataType: newField.dataType,
        entityTypes: newField.entityTypes,
        options: newField.options ? newField.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      });
      toast("success", "Field added.");
      setAdding(false);
      setNewField({ label: "", dataType: "TEXT", entityTypes: "BOTH", options: "" });
      reload();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not add field.");
    }
  }

  async function disable(field: FieldDTO) {
    if (field.isCore) {
      toast("warning", "Core fields can be hidden but not deleted. Use the Active toggle.");
      return;
    }
    if (!confirm(`Disable "${field.label}"? Historical values are kept.`)) return;
    try {
      await api.disableField(field.id);
      reload();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not disable field.");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="animate-slide-in flex h-full w-full max-w-xl flex-col overflow-auto border-l p-5" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Field settings</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          Rename, show/hide, or add fields. Core fields power search and matching and can be hidden but not deleted.
          Disabling a field keeps its historical values.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add field"}</Button>
          <Button variant="secondary" onClick={() => { triggerDownload("/api/settings/fields/export"); }}>
            Export config (JSON)
          </Button>
        </div>

        {adding && (
          <div className="mb-4 space-y-2 rounded-lg border p-3" style={{ background: "var(--surface-muted)" }}>
            <input className="w-full rounded-md border px-2 py-1.5 text-sm" style={{ background: "var(--surface)" }} placeholder="Field label (e.g. Possession Date)" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
            <div className="flex gap-2">
              <select className="rounded-md border px-2 py-1.5 text-sm" style={{ background: "var(--surface)" }} value={newField.dataType} onChange={(e) => setNewField({ ...newField, dataType: e.target.value })}>
                {DATA_TYPES.map((t) => <option key={t} value={t}>{prettyEnum(t)}</option>)}
              </select>
              <select className="rounded-md border px-2 py-1.5 text-sm" style={{ background: "var(--surface)" }} value={newField.entityTypes} onChange={(e) => setNewField({ ...newField, entityTypes: e.target.value })}>
                <option value="BOTH">Both</option>
                <option value="BUYER">Buyers</option>
                <option value="SELLER">Sellers</option>
              </select>
            </div>
            {(newField.dataType === "SINGLE_SELECT" || newField.dataType === "MULTI_SELECT") && (
              <input className="w-full rounded-md border px-2 py-1.5 text-sm" style={{ background: "var(--surface)" }} placeholder="Options, comma separated" value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} />
            )}
            <Button onClick={addField}>Save field</Button>
          </div>
        )}

        {loading ? (
          <Spinner label="Loading fields..." />
        ) : (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.id} className="rounded-lg border p-3 text-sm" style={{ background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.label}</span>
                    {f.isCore && <Badge tone="accent">core</Badge>}
                    <Badge tone="neutral">{prettyEnum(f.dataType)}</Badge>
                    <Badge tone="neutral">{prettyEnum(f.entityTypes)}</Badge>
                  </div>
                  {!f.isCore && (
                    <button className="text-xs underline" style={{ color: "var(--danger)" }} onClick={() => disable(f)}>
                      disable
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Toggle label="Active" checked={f.isActive} onChange={() => toggle(f, "isActive")} />
                  <Toggle label="In table" checked={f.showInTable} onChange={() => toggle(f, "showInTable")} />
                  <Toggle label="In export" checked={f.includeInExport} onChange={() => toggle(f, "includeInExport")} />
                  <Toggle label="Searchable" checked={f.isSearchable} onChange={() => toggle(f, "isSearchable")} />
                  <Toggle label="AI extract" checked={f.aiExtractable} onChange={() => toggle(f, "aiExtractable")} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span style={{ color: "var(--muted)" }}>{label}</span>
    </label>
  );
}
