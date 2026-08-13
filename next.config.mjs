import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Optional — missing on Hostinger when npm omits devDependencies. */
let withBundleAnalyzer = (config) => config;
try {
  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
  });
} catch {
  if (process.env.ANALYZE === "true") {
    console.warn(
      "[next.config] @next/bundle-analyzer not installed — continuing without ANALYZE"
    );
  }
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://www.google-analytics.com https://www.googletagmanager.com https://*.google-analytics.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
      "media-src 'self' https: blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  serverExternalPackages: ["pdfkit"],
  poweredByHeader: false,
  compress: true,
  // Hostinger linux builds sometimes miss tsconfig path mapping for `@/`
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
  images: {
    // Only allow known thumbnail hosts — blocks open /_next/image proxy (H2).
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "lmsclasses.com" },
      { protocol: "https", hostname: "www.lmsclasses.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
  },
  experimental: {
    /** Allow large certificate background uploads through middleware (default is 10MB). */
    middlewareClientMaxBodySize: "62mb",
    serverActions: {
      bodySizeLimit: "62mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-table",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
    ],
  },
  async redirects() {
    return [
      // Browsers always request /favicon.ico; we ship favicon.png
      { source: "/favicon.ico", destination: "/favicon.png", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/favicon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/apple-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/lms-logo.jpg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Do NOT set Cache-Control for /uploads here — app/uploads/[...path]/route.ts
      // controls it (success: short cache; 404: no-store so restored files are not stuck).
      {
        source: "/site.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/hr/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/hr/register",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
