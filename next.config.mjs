/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only for `npm run build:dist` — avoids breaking `npm run dev` CSS after a normal build
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
