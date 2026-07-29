import Link from "next/link";

/** Shared colophon for both the full and compact public shells. */
export default function SiteFooter() {
  return (
    <footer className="site">
      <div className="colophon-block">
        <div>
          <span className="lbl">The Board</span>
          <p className="colophon-note">
            Public statements, played back and scored for sarcasm. The vote is
            on the clip, never the person.
          </p>
        </div>
        <div>
          <span className="lbl">Found a better clip?</span>
          <p className="colophon-note">
            <Link href="/submit">Send it in.</Link> Corrections, context and
            replies stay attached to the entry.
          </p>
        </div>
        <div>
          <span className="lbl">On the record</span>
          <p className="colophon-note">
            <Link href="/watch">Watch</Link> &middot;{" "}
            <Link href="/duel">Aamne-Saamne</Link> &middot;{" "}
            <Link href="/standings">Standings</Link> &middot;{" "}
            <Link href="/record">Archive</Link> &middot;{" "}
            <Link href="/rules">Rules</Link> &middot;{" "}
            <Link href="/privacy">Privacy</Link> &middot;{" "}
            <Link href="/terms">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
