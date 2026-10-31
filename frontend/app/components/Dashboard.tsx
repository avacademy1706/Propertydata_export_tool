"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, ChevronDown, FileDown, RefreshCw, MessageCircle, Home, TriangleAlert, X, LogOut } from "lucide-react";
import { api } from "@/app/lib/api.ts";
import { ToastProvider, triggerDownload, useToast, ThemeToggle } from "@/app/components/ui.tsx";
import { SummaryCards } from "@/app/components/SummaryCards.tsx";
import { RecordsTable, MatchingTable } from "@/app/components/tables.tsx";
import { WhatsAppAssistant } from "@/app/components/WhatsAppAssistant.tsx";
import { DetailDrawer } from "@/app/components/DetailDrawer.tsx";
import type { StatusResponse } from "@/app/lib/types.ts";

type Tab = "buyers" | "sellers" | "matching";

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}

const DATE_PRESETS: Array<{ key: string; label: string; since: () => string | undefined }> = [
  { key: "all", label: "All time", since: () => undefined },
  { key: "month", label: "This month", since: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() },
  { key: "week", label: "Last 7 days", since: () => new Date(Date.now() - 7 * 864e5).toISOString() },
  { key: "today", label: "Today", since: () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString() },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", boxShadow: "0 6px 16px -4px color-mix(in srgb, var(--accent) 50%, transparent)" }}>
        <Home size={18} aria-hidden="true" />
      </div>
      <span className="text-lg font-bold tracking-tight">
        Property <span style={{ color: "var(--accent)" }}>Desk</span>
      </span>
    </div>
  );
}

function WarningsBanner({ warnings }: { warnings: string[] }) {
  const key = warnings.join("|");
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const apply = () => {
      try {
        setDismissed(localStorage.getItem("pd:warn") === key);
      } catch {
        /* ignore */
      }
    };
    apply();
  }, [key]);
  if (warnings.length === 0 || dismissed) return null;
  function dismiss() {
    try {
      localStorage.setItem("pd:warn", key);
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-xs" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
      <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Setup notice ({warnings.length})</p>
        <div className={expanded ? "mt-1 space-y-0.5" : "mt-1 line-clamp-1"}>
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
        {warnings.length > 1 && (
          <button onClick={() => setExpanded((e) => !e)} className="mt-1 underline" style={{ color: "var(--warning)" }}>
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss notice" className="shrink-0 rounded-md p-1 hover:opacity-70">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function DashboardInner() {
  const [tab, setTab] = useState<Tab>("buyers");
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [drawer, setDrawer] = useState<{ kind: "buyer" | "seller"; id: string } | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("all");
  const [dateMenu, setDateMenu] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [auth, setAuth] = useState<{ authEnabled: boolean; email: string | null }>({ authEnabled: false, email: null });
  const toast = useToast();

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json().catch(() => ({}));
        setAuth({ authEnabled: Boolean(data?.authEnabled), email: data?.user?.email ?? null });
      } catch {
        /* ignore */
      }
    };
    void run();
  }, []);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Hard navigation on purpose: a full reload clears all in-memory records
    // and cached state after signing out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  useEffect(() => {
    const apply = () => {
      try {
        setAssistantOpen(window.matchMedia("(min-width: 1024px)").matches);
      } catch {
        /* ignore */
      }
    };
    apply();
  }, []);

  const loadStatus = useCallback(() => {
    api.status().then(setStatus).catch(() => undefined);
  }, []);
  useEffect(loadStatus, [loadStatus, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function recalc() {
    setRecalculating(true);
    try {
      const res = await api.recalculate();
      toast("success", res.message);
      refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  const since = DATE_PRESETS.find((p) => p.key === datePreset)?.since();
  const dateLabel = DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? "All time";
  const title = tab.charAt(0).toUpperCase() + tab.slice(1);

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header with brand + global actions */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6" style={{ background: "var(--sidebar)", borderColor: "var(--border-strong)" }}>
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <div className="relative">
              <button onClick={() => setDateMenu((m) => !m)} aria-haspopup="true" aria-expanded={dateMenu} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}>
                <Calendar size={15} aria-hidden="true" /> <span className="hidden sm:inline">{dateLabel}</span> <ChevronDown size={14} aria-hidden="true" />
              </button>
              {dateMenu && (
                <div className="pop absolute left-0 z-30 mt-1 w-40 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border sm:left-auto sm:right-0" style={{ background: "var(--surface)" }}>
                  {DATE_PRESETS.map((p) => (
                    <button key={p.key} onClick={() => { setDatePreset(p.key); setDateMenu(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]" style={{ color: p.key === datePreset ? "var(--accent)" : "var(--foreground)" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setAssistantOpen((o) => !o)} aria-label={assistantOpen ? "Hide assistant" : "Show assistant"} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium" style={{ background: assistantOpen ? "var(--whatsapp-soft)" : "var(--surface)", borderColor: "var(--border-strong)", color: assistantOpen ? "var(--whatsapp)" : "var(--muted)" }}>
              <MessageCircle size={15} aria-hidden="true" /> <span className="hidden md:inline">Assistant</span>
            </button>
            <button onClick={() => triggerDownload(api.exportUrl("all"))} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
              <FileDown size={15} aria-hidden="true" /> <span className="hidden sm:inline">Export</span>
            </button>
            {auth.authEnabled && (
              <button onClick={signOut} aria-label="Sign out" title={auth.email ? `Sign out (${auth.email})` : "Sign out"} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium" style={{ background: "var(--surface)", borderColor: "var(--border-strong)", color: "var(--muted)" }}>
                <LogOut size={15} aria-hidden="true" /> <span className="hidden lg:inline">Sign out</span>
              </button>
            )}
          </div>
        </header>

        <main id="main-content" aria-label="Property records" className="scroll-area flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              {status?.summary.lastSync && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>Last update {new Date(status.summary.lastSync).toLocaleString()}</p>
              )}
            </div>
            {tab === "matching" && (
              <button onClick={recalc} disabled={recalculating} className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}>
                <RefreshCw size={15} className={recalculating ? "animate-spin" : ""} aria-hidden="true" /> Recalculate
              </button>
            )}
          </div>

          <WarningsBanner warnings={status?.warnings ?? []} />

          <div className="mb-5">
            <SummaryCards summary={status?.summary ?? null} />
          </div>

          <div role="tablist" aria-label="Record type" className="mb-4 flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {(["buyers", "sellers", "matching"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="relative px-4 py-2.5 text-sm font-medium capitalize transition" style={{ color: tab === t ? "var(--accent)" : "var(--muted)" }}>
                {t}
                {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
              </button>
            ))}
          </div>

          {tab === "buyers" && <RecordsTable key={`buyer-${since ?? "all"}`} kind="buyer" refreshKey={refreshKey} since={since} onOpen={(id) => setDrawer({ kind: "buyer", id })} onChanged={refresh} />}
          {tab === "sellers" && <RecordsTable key={`seller-${since ?? "all"}`} kind="seller" refreshKey={refreshKey} since={since} onOpen={(id) => setDrawer({ kind: "seller", id })} onChanged={refresh} />}
          {tab === "matching" && <MatchingTable refreshKey={refreshKey} />}
        </main>
      </div>

      {/* Assistant — right column on large screens */}
      {assistantOpen && (
        <div className="hidden w-96 shrink-0 lg:block">
          <WhatsAppAssistant onProcessed={refresh} onViewAll={setTab} onClose={() => setAssistantOpen(false)} />
        </div>
      )}

      {/* Assistant — overlay sheet below lg */}
      {assistantOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" style={{ background: "rgba(10,15,29,0.5)" }} onClick={() => setAssistantOpen(false)}>
          <div className="absolute inset-y-0 right-0 w-full max-w-md animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <WhatsAppAssistant onProcessed={refresh} onViewAll={(t) => { setTab(t); setAssistantOpen(false); }} onClose={() => setAssistantOpen(false)} />
          </div>
        </div>
      )}

      {drawer && <DetailDrawer kind={drawer.kind} id={drawer.id} onClose={() => setDrawer(null)} onChanged={refresh} />}
    </div>
  );
}
