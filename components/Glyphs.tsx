/**
 * Every mark on the site, hand-drawn. No icon library — Lucide and
 * Heroicons are instantly recognisable and would undo the rest of the
 * design work (docs/07-design-language.md §7.8).
 *
 * Rendered once in the root layout; referenced with <use href="#...">.
 */
export default function Glyphs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="m-participation" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2.4" />
        </symbol>

        <symbol id="m-bronze" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth=".8" />
        </symbol>

        <symbol id="m-silver" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth=".8" />
          <path d="M8.6 13.4 12 9.9l3.4 3.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </symbol>

        <symbol id="m-gold" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth=".7" />
          <path d="M4.6 12a7.6 7.6 0 0 0 3.2 6.4M19.4 12a7.6 7.6 0 0 1-3.2 6.4" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M12 9.2l1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 14.72l-2.17 1.14.42-2.4-1.75-1.7 2.4-.35z" fill="currentColor" />
        </symbol>

        <symbol id="m-diamond" viewBox="0 0 24 24">
          <path d="M12 3.2 20 12l-8 8.8L4 12z" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M12 3.2 8.4 12 12 20.8 15.6 12z" fill="none" stroke="currentColor" strokeWidth=".7" />
          <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth=".7" />
        </symbol>

        <symbol id="m-kohinoor" viewBox="0 0 24 24">
          <path d="M12 2.4 20.4 12 12 21.6 3.6 12z" fill="none" stroke="currentColor" strokeWidth="1.35" />
          <path d="M12 2.4 8 12l4 9.6L16 12z" fill="none" stroke="currentColor" strokeWidth=".7" />
          <path d="M3.6 12h16.8M6.6 6.9l10.8 10.2M17.4 6.9 6.6 17.1" fill="none" stroke="currentColor" strokeWidth=".55" opacity=".75" />
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        </symbol>

        <symbol id="g-seal" viewBox="0 0 64 64">
          <path
            d="M32 3.5 38 8l7.4-1.6 3.9 6.4 7.3 1.9-.6 7.5 5.4 5.3-4.2 6.3 2.6 7.1-6.3 4.2-.7 7.5-7.4 1.3-4.4 6.2-7-2.7-6.3 4.2-5.3-5.4-7.5.5-2-7.3-6.4-3.9L11 40l-4.6-6 4.6-6-1.6-7.4 6.4-3.9 2-7.3 7.5.5 5.3-5.4z"
            fill="none" stroke="currentColor" strokeWidth="1.4"
          />
          <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth=".9" />
          <circle cx="32" cy="32" r="13.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
        </symbol>

        <symbol id="g-play" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(220,227,212,.6)" strokeWidth="1.2" />
          <path d="M26 21.5 44 32 26 42.5z" fill="none" stroke="rgba(220,227,212,.8)" strokeWidth="1.6" />
        </symbol>
      </defs>
    </svg>
  );
}
