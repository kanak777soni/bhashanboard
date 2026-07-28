/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Source-platform poster frames remain remote. Rights-cleared administrator
  // uploads are served as native video from the configured R2 custom domain.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
