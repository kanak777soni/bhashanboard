import Masthead from "./Masthead";
import SiteNav from "./SiteNav";
import Ticker from "./Ticker";

/** Every page except the duel wears this. The duel is deliberately bare. */
export default function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      <Masthead />
      <SiteNav />
      <Ticker />
      {children}
      <footer className="site">
        <p>
          <strong>This is a development build.</strong> Every entry, representative and party shown is
          invented. No real person is quoted anywhere on this site.
        </p>
        <p>
          Type is currently rendering in system fallbacks. Production self-hosts Libre Caslon Display,
          Source Serif&nbsp;4, Archivo and Tiro Devanagari Hindi via <code>next/font</code>.
        </p>
        <p>
          Guilloché engraving is drawn live on canvas from hypotrochoid curves &mdash; no image assets.
          Medals and the wax seal are eight hand-drawn marks; no icon library is used.
        </p>
      </footer>
    </div>
  );
}
