/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Source-platform poster frames remain remote. Rights-cleared administrator
  // uploads are delivered through a server-generated signed Cloudinary URL.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
