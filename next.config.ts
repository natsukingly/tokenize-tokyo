import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.TOKENIZE_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // The wallet-free demo can be embedded by our own presentation page.
        // Wallet and transaction pages retain the default DENY policy.
        source: "/demo",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        // The static animated diagram is another presentation-only surface.
        source: "/pitch/architecture/index.html",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};
export default config;
