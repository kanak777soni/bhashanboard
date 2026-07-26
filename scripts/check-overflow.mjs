/**
 * Horizontal-overflow regression check.
 *
 * This design is dense and table-heavy, so the classic grid/flex
 * `min-width: auto` bug — a wide table refusing to shrink and widening the
 * whole document instead of scrolling inside its own container — is a
 * standing risk. The body must never scroll sideways on a phone.
 *
 *   npm run build && npm start &
 *   node scripts/check-overflow.mjs
 *
 * Exits non-zero if any route overflows.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EXECUTABLE = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WIDTHS = [360, 390, 768, 1400];
const ROUTES = [
  "/",
  "/?party=JLP&tier=diamond",
  "/duel",
  "/netas",
  "/neta/r-venkataraman",
  "/statement/monsoon-instructed-thursday",
  "/ledger",
  "/rules",
  "/submit",
  "/hall",
];

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
let failures = 0;

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const offenders = [];
      document.querySelectorAll("*").forEach((el) => {
        // The ticker track is meant to be wider than its clipping viewport.
        if (el.closest(".ticker-viewport")) return;
        const box = el.getBoundingClientRect();
        if (box.right > docW + 1 && box.width > 0) {
          offenders.push(el.tagName.toLowerCase() + "." + String(el.className ?? "").slice(0, 40));
        }
      });
      return { scrollW: document.documentElement.scrollWidth, docW, offenders: offenders.slice(0, 5) };
    });
    const bad = result.scrollW > result.docW;
    if (bad) failures++;
    console.log(
      (bad ? "FAIL" : "ok  ") +
        "  " + String(width).padStart(4) + "px  " + route +
        (bad ? "  scrollW=" + result.scrollW + " — " + result.offenders.join(", ") : "")
    );
  }
  await page.close();
}

await browser.close();

if (failures) {
  console.error("\n" + failures + " route/width combinations scroll horizontally.");
  process.exit(1);
}
console.log("\nNo horizontal overflow.");
