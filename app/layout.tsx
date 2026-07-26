import type { Metadata } from "next";
import Glyphs from "@/components/Glyphs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bhashanboard.example"),
  title: {
    default: "The Bhashan Board",
    template: "%s — The Bhashan Board",
  },
  description:
    "An archive of public wisdom. Independently ranked. Verbatim, sourced statements by elected representatives, ranked by pairwise duel.",
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
        <div className="specimen">
          Specimen &middot; all entries, representatives and parties are fictional &middot; development build
        </div>
        {children}
      </body>
    </html>
  );
}
