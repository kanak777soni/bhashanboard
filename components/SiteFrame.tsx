import Link from "next/link";
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
        <div className="colophon-block">
          <div>
            <span className="lbl">The Committee</span>
            <p className="colophon-note">
              Established 2026. Sits weekly. Rules on statements, never on persons. Declines to
              comment on anything else.
            </p>
          </div>
          <div>
            <span className="lbl">Correspondence</span>
            <p className="colophon-note">
              To the Registrar. Offices wishing to exercise the right of reply are answered in order
              of receipt, and always answered.
            </p>
          </div>
          <div>
            <span className="lbl">Standing orders</span>
            <p className="colophon-note">
              <Link href="/rules">The Rules</Link> &middot; <Link href="/ledger">The Ledger</Link>{" "}
              &middot; <Link href="/submit">Submissions</Link>
            </p>
          </div>
        </div>
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
