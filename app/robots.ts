import type { MetadataRoute } from "next";
import { resolvedPublicSiteUrl } from "@/lib/auth-config";

const BASE = resolvedPublicSiteUrl();
const PRELAUNCH = process.env.SITE_PRELAUNCH !== "false";

export default function robots(): MetadataRoute.Robots {
  if (PRELAUNCH) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
