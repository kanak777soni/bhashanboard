import { ImageResponse } from "next/og";
import { STATS, parity } from "@/lib/data";

export const alt = "The Bhashan Board — an archive of public wisdom, independently ranked";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const INK = "#141D18";
  const PAPER = "#E4E9DD";
  const bands = parity().slice(0, 6);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: PAPER, color: INK, display: "flex", flexDirection: "column", padding: 64, border: `14px solid ${INK}`, fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 96, letterSpacing: -2, lineHeight: 1 }}>The Bhashan Board</div>
          <div style={{ fontSize: 34, fontStyle: "italic", color: "#4a5450", marginTop: 20 }}>
            An archive of public wisdom. Independently ranked.
          </div>
          <div style={{ fontSize: 22, letterSpacing: 3, color: "#8E2230", marginTop: 26, textTransform: "uppercase" }}>
            {`\u201CDicta manent\u201D — what was said, remains`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 54, borderTop: `2px solid ${INK}`, paddingTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Indexed</span>
            <span style={{ fontSize: 46 }}>{STATS.indexed}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Representatives</span>
            <span style={{ fontSize: 46 }}>{STATS.representatives}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, letterSpacing: 3, color: "#5c6660", textTransform: "uppercase" }}>Parties</span>
            <span style={{ fontSize: 46 }}>{bands.length}</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
