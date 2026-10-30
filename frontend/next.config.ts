import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages are loaded at runtime instead of being bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
