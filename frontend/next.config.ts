import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages are loaded at runtime instead of being bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp", "exceljs"],
  // Tailwind CSS v4 is wired through PostCSS (see postcss.config.mjs); Turbopack
  // detects it automatically, so no custom CSS loader rule is needed. The previous
  // @tailwindcss/turbopack loader caused an infinite dev-server recompile loop.

  // Backend integration: when BACKEND_URL is set, every /api request is proxied to
  // the Python/FastAPI service EXCEPT /api/auth/* (login/logout/me stay in Next, which
  // owns the session cookie and login UI). Without BACKEND_URL the built-in TypeScript
  // route handlers serve /api as before. The proxy.ts middleware still gates the session
  // before the rewrite forwards the request, so the backend can run on a private network.
  async rewrites() {
    const backend = process.env.BACKEND_URL?.replace(/\/+$/, "");
    if (!backend) return [];
    return {
      beforeFiles: [
        {
          // :rest matches everything after /api/ that does not start with "auth/".
          source: "/api/:rest((?!auth/).*)",
          destination: `${backend}/api/:rest`,
        },
      ],
    };
  },
};

export default nextConfig;

// Deploy: Vercel builds from frontend/ with Supabase (Postgres + Storage).
