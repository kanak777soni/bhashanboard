import type { Metadata } from "next";
import Glyphs from "@/components/Glyphs";
import { resolvedPublicSiteUrl } from "@/lib/auth-config";
import "./globals.css";

const SITE_URL = resolvedPublicSiteUrl();
const PRELAUNCH = process.env.SITE_PRELAUNCH !== "false";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Bhashan Board",
    template: "%s — The Bhashan Board",
  },
  description:
    "An archive of public wisdom. Sourced statements by elected representatives, ranked by verified one-time public rulings.",
  robots: PRELAUNCH
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    siteName: "The Bhashan Board",
    type: "website",
  },
};

/** Applies the stored theme before first paint so there is no flash. */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem('bb-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <Glyphs />
        {PRELAUNCH && (
          <div className="specimen">
            Pre-launch &middot; research records remain provisional until committee-passed
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
