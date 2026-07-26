/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Video is embedded, never hosted — see docs/03-content-pipeline.md §3.1.
  // Only poster frames are served, and those come from the source platform.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
