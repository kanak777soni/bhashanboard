import Link from "next/link";
import Guilloche from "./Guilloche";
import ThemeToggle from "./ThemeToggle";
import { EDITION, STATEMENTS, parity } from "@/lib/data";

export default function Masthead() {
  const bands = parity();

  return (
    <>
      <header className="masthead">
        <Guilloche variant="band" />
        <div className="mast-inner">
          <div>
            <h1 className="nameplate">
              <Link href="/">The Bhashan Board</Link>
            </h1>
            <p className="tagline">An archive of public wisdom. Independently ranked.</p>
          </div>
          <div className="colophon">
            <div className="lbl">Edition {EDITION.number}</div>
            <div className="lbl">{EDITION.date}</div>
            <div className="lbl">
              <span className="num">{STATEMENTS.length.toLocaleString("en-IN")}</span> entries on record
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="parity">
        <span className="lbl">Parity</span>
        <div
          className="parity-bar"
          role="img"
          aria-label={`Party distribution: ${bands.map((b) => `${b.code} ${b.pct}%`).join(", ")}`}
        >
          {bands.map((b) => (
            <span key={b.code} style={{ width: `${b.pct}%`, background: b.ink }} />
          ))}
        </div>
        <div className="parity-legend lbl">
          {bands.map((b) => (
            <span key={b.code}>
              <i className="swatch" style={{ background: b.ink }} />
              {b.code} <b className="num">{b.pct}%</b>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
