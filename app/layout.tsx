import type { Metadata } from "next";
import Glyphs from "@/components/Glyphs";
import { resolvedPublicSiteUrl } from "@/lib/auth-config";
import "./globals.css";
import "./mobile.css";

const SITE_URL = resolvedPublicSiteUrl();
const PRELAUNCH = process.env.SITE_PRELAUNCH !== "false";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Bhashan Board",
    template: "%s — The Bhashan Board",
  },
  description:
    "Public speeches, public sarcasm: watch the moments, enter one ruling, and see which class each clip earns.",
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
            <span className="specimen-wide">
              Pre-launch &middot; clips, votes and scores are still being tested
            </span>
            <span className="specimen-mobile">
              Pre-launch &middot; test Board
            </span>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
