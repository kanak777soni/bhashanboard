import { ImageResponse } from "next/og";
import { getData } from "@/lib/data";
import { tierOf } from "@/lib/tiers";

export const runtime = "edge";
export const alt = "The Bhashan Board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CARD_QUOTE_LIMIT = 220;

function cardExcerpt(text: string): string {
  if (text.length <= CARD_QUOTE_LIMIT) return text;
  const candidate = text.slice(0, CARD_QUOTE_LIMIT - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const cutAt = lastSpace >= Math.floor(CARD_QUOTE_LIMIT * 0.7) ? lastSpace : candidate.length;
  return `${candidate.slice(0, cutAt).trimEnd()}…`;
}

/**
 * The share card.
 *
 * WhatsApp is the distribution layer in India and a WhatsApp forward is a
 * link preview, so this image *is* the growth loop
 * (docs/05-growth-and-money.md §5.1). It has to carry the whole entry at a
 * glance: rank, grade, what was said, who said it.
 *
 * It also has to keep the corpus's honesty rules. An entry whose wording
 * was never established is rendered without quotation marks and labelled,
 * exactly as on the page — a share card is the most-copied surface on the
 * site and the worst possible place to manufacture a quotation.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getData();
  const s = data.statementBySlug((await params).slug);

  const INK = "#141D18";
  const PAPER = "#E4E9DD";
  const FOIL = "#A9853A";
  const SEAL = "#8E2230";

  if (!s) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", background: PAPER, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
          The Bhashan Board
        </div>
      ),
      size
    );
  }

  const neta = data.netaBySlug(s.neta);
  const tier = tierOf(s.gp);
  const rank = s.held ? null : data.rankOf(s.slug);
  const translatedQuote = s.language !== "English" ? s.quoteTranslation : undefined;
  const shareText = s.quote || s.neutralTitle;
  const translationExcerpted =
    Boolean(translatedQuote) && translatedQuote!.length > CARD_QUOTE_LIMIT;
  const headline = s.hasVerbatimQuote ? `“${cardExcerpt(shareText)}”` : s.neutralTitle;
  const headlineSize = headline.length > 190 ? 38 : headline.length > 110 ? 46 : 58;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", background: PAPER, color: INK,
          display: "flex", flexDirection: "column", padding: 56,
          border: `14px solid ${INK}`, fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${INK}`, paddingBottom: 16 }}>
          <div style={{ fontSize: 30, letterSpacing: -0.5 }}>The Bhashan Board</div>
          <div style={{ fontSize: 17, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>
            {`Entry No. ${s.corpusId}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", paddingTop: 12 }}>
          <div style={{ fontSize: headlineSize, lineHeight: 1.18, letterSpacing: -1 }}>{headline}</div>
          {translatedQuote && (
            <div style={{ display: "flex", fontSize: 21, lineHeight: 1.25, color: FOIL, marginTop: 16 }}>
              {translationExcerpted ? "English excerpt: " : "English: "}
              {cardExcerpt(translatedQuote)}
            </div>
          )}
          {!s.hasVerbatimQuote && (
            <div style={{ fontSize: 18, letterSpacing: 2, color: SEAL, marginTop: 16, textTransform: "uppercase" }}>
              Wording not established — neutral subject line, not a quotation
            </div>
          )}
          <div style={{ fontSize: 26, color: "#4a5450", marginTop: 22, fontStyle: "italic" }}>
            {`${neta?.name ?? "Unknown"} · ${s.office || s.partyAtTime} · ${s.venue}`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `2px solid ${INK}`, paddingTop: 18 }}>
          <div style={{ display: "flex", gap: 46 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Rank</span>
              <span style={{ fontSize: 42 }}>{rank ? `#${rank}` : "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Rating</span>
              <span style={{ fontSize: 42 }}>{s.held ? "—" : s.gp.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Grade</span>
              <span style={{ fontSize: 42, color: FOIL }}>{s.held ? "Not placed" : tier.name}</span>
            </div>
          </div>
          <div style={{ fontSize: 17, letterSpacing: 2, color: "#5c6660", textTransform: "uppercase" }}>
            Independently ranked
          </div>
        </div>
      </div>
    ),
    size
  );
}
