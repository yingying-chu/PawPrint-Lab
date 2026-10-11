import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // vinext treats every multipart POST as a possible progressive server
    // action and rejects it above this limit before route handlers run.
    // Keep it above the 10 MB cap enforced in app/api/uploads/route.ts.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
