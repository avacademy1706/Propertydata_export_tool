"use client";

import { UserRound, UsersRound, Link2, Clock, ArrowUp, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StatusResponse, Trend } from "@/app/lib/types.ts";

type Summary = StatusResponse["summary"];

interface CardDef {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  soft: string;
  trend?: Trend;
}

export function SummaryCards({ summary }: { summary: Summary | null }) {
  const s = summary;
  const cards: CardDef[] = [
    { label: "Total Buyers", value: s?.totalBuyers ?? 0, icon: UserRound, color: "var(--success)", soft: "var(--success-soft)", trend: s?.trends?.buyers },
    { label: "Total Sellers", value: s?.totalSellers ?? 0, icon: UsersRound, color: "var(--accent)", soft: "var(--accent-soft)", trend: s?.trends?.sellers },
    { label: "Strong Matches", value: s?.strongMatches ?? 0, icon: Link2, color: "var(--info)", soft: "var(--info-soft)", trend: s?.trends?.strongMatches },
    { label: "Needs Review", value: s?.needsReview ?? 0, icon: Clock, color: "var(--danger)", soft: "var(--danger-soft)", trend: s?.trends?.needsReview },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="elevated rounded-2xl border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11" style={{ background: c.soft, color: c.color }}>
              <c.icon size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-sm" style={{ color: "var(--muted)" }}>
                {c.label}
              </p>
              <p className="tabular mt-0.5 text-2xl font-bold leading-none sm:text-3xl">{c.value}</p>
            </div>
          </div>
          {c.trend && <TrendRow trend={c.trend} />}
        </div>
      ))}
    </div>
  );
}

function TrendRow({ trend }: { trend: Trend }) {
  const up = trend.direction === "up";
  const flat = trend.direction === "flat";
  const color = flat ? "var(--muted)" : up ? "var(--success)" : "var(--danger)";
  const Icon = up ? ArrowUp : ArrowDown;
  const label = flat ? "No change this month" : `${up ? "Up" : "Down"} ${trend.percent}% this month`;
  return (
    <div className="mt-4 flex items-center gap-1.5 text-xs" aria-label={label}>
      {!flat && <Icon size={14} style={{ color }} aria-hidden="true" />}
      <span style={{ color }} className="tabular font-semibold">
        {flat ? "No change" : `${trend.percent}%`}
      </span>
      <span style={{ color: "var(--muted)" }}>this month</span>
    </div>
  );
}
