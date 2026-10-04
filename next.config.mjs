/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,

  // The database engine runs as an embedded PostgreSQL (PGlite), which loads a
  // WASM build at runtime. It must not be bundled, so it is treated as an
  // external dependency and initialized as a Node module by the server runtime.
  serverExternalPackages: ["@electric-sql/pglite"],

  // Security headers applied to every response. The API is same-origin, so no
  // permissive CORS policy is configured: cross-origin reads are not allowed.
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    // HSTS only makes sense when the deployment actually terminates TLS.
    if (isProduction) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses are user-specific and must never be cached by a shared
        // proxy or the browser.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
    ];
  },
};

export default nextConfig;