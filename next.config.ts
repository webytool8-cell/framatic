import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional, server-only dependency for rendering client-side sites.
  serverExternalPackages: ["playwright"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
