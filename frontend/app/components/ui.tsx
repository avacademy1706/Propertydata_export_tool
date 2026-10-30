"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";

// ---- Toasts ----------------------------------------------------------------

type ToastKind = "success" | "warning" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-in rounded-lg border px-4 py-3 text-sm shadow-lg"
            style={{
              background: "var(--surface)",
              borderColor:
                t.kind === "success"
                  ? "var(--success)"
                  : t.kind === "warning"
                    ? "var(--warning)"
                    : t.kind === "error"
                      ? "var(--danger)"
                      : "var(--border)",
            }}
          >
            <span
              className="mr-2 font-semibold"
              style={{
                color:
                  t.kind === "success"
                    ? "var(--success)"
                    : t.kind === "warning"
                      ? "var(--warning)"
                      : t.kind === "error"
                        ? "var(--danger)"
                        : "var(--accent)",
              }}
            >
              {t.kind === "success" ? "✓" : t.kind === "warning" ? "!" : t.kind === "error" ? "✕" : "i"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---- Primitives ------------------------------------------------------------

export function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<string, string> = {
    primary: "text-white",
    secondary: "border",
    ghost: "",
    danger: "text-white",
  };
  const inline: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--accent)" }
      : variant === "danger"
        ? { background: "var(--danger)" }
        : variant === "secondary"
          ? { background: "var(--surface)", color: "var(--foreground)" }
          : { color: "var(--muted)" };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`} style={inline} title={title}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent" | "whatsapp" | "info" }) {
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--surface-muted)", fg: "var(--muted)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    whatsapp: { bg: "var(--whatsapp-soft)", fg: "var(--whatsapp)" },
    info: { bg: "var(--info-soft)", fg: "var(--info)" },
  };
  const c = map[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
      {label}
    </span>
  );
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Trigger a file download for an API/file URL without navigating the SPA. */
export function triggerDownload(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Light/dark theme toggle. Reads the attribute set by the no-flash init script. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const apply = () => {
      try {
        const t = document.documentElement.getAttribute("data-theme");
        setTheme(t === "dark" ? "dark" : "light");
      } catch {
        /* ignore */
      }
    };
    apply();
  }, []);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pd:theme", next);
    } catch {
      /* ignore */
    }
  }
  return (
    <button onClick={toggle} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} className="rounded-lg border p-2 transition hover:bg-[var(--surface-muted)]" style={{ background: "var(--surface)", borderColor: "var(--border-strong)", color: "var(--muted)" }}>
      {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
    </button>
  );
}

export function prettyEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function verificationTone(status: string): "success" | "warning" | "neutral" {
  if (status === "VERIFIED") return "success";
  if (status === "NEEDS_REVIEW") return "warning";
  return "neutral";
}
