import Link from "next/link";
import Guilloche from "./Guilloche";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import ThemeToggle from "./ThemeToggle";

/**
 * A compact, theme-preserving shell for the watch journey.
 *
 * It retains the nameplate, guilloché, institutional navigation and colophon
 * without forcing the full editorial masthead and parity band above the clip.
 */
export default function ScreeningFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="wrap screening-shell">
      <header className="masthead screening-masthead">
        <Guilloche variant="band" />
        <div className="mast-inner screening-mast-inner">
          <div className="screening-brand">
            <p className="nameplate screening-nameplate">
              <Link href="/">The Bhashan Board</Link>
            </p>
            <p className="motto screening-motto">
              Watch the clip &middot; vote once &middot; see where it lands
            </p>
          </div>
          <div className="screening-tools">
            <span className="lbl">Now watching</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <SiteNav />
      <main className="screening-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
