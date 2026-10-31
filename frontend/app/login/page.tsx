"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Mail, Lock, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error?.message ?? "Sign in failed.");
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", boxShadow: "0 8px 20px -6px color-mix(in srgb, var(--accent) 55%, transparent)" }}>
            <Home size={24} aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">
              Property <span style={{ color: "var(--accent)" }}>Desk</span>
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="elevated rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }} htmlFor="email">Email</label>
          <div className="relative mb-4">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-soft)" }} aria-hidden="true" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{ background: "var(--surface-muted)", borderColor: "var(--border-strong)", color: "var(--foreground)" }}
            />
          </div>

          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted)" }} htmlFor="password">Password</label>
          <div className="relative mb-5">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-soft)" }} aria-hidden="true" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{ background: "var(--surface-muted)", borderColor: "var(--border-strong)", color: "var(--foreground)" }}
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: "var(--muted-soft)" }}>
          Property Desk · secure sign in
        </p>
      </div>
    </main>
  );
}
