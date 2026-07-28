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
const DEFAULT_WIDTHS = [320, 360, 390, 430, 640, 768, 1400];
const WIDTHS = process.env.WIDTHS
  ? process.env.WIDTHS.split(",").map((value) => Number.parseInt(value.trim(), 10))
  : DEFAULT_WIDTHS;
const ROUTES = [
  "/",
  "/?party=BJP&tier=gold",
  "/duel",
  "/netas",
  "/neta/narendra-modi",
  "/statement/on-ganesha-karna-and-the-antiquity-of-surgery-in-0002",
  "/ledger",
  "/rules",
  "/submit",
  "/hall",
  "/sign-in",
  "/sign-up",
  "/account",
  "/admin",
];

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
let failures = 0;

async function measureOverflow(page) {
  return page.evaluate(() => {
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
    return {
      scrollW: document.documentElement.scrollWidth,
      docW,
      offenders: offenders.slice(0, 5),
    };
  });
}

function report(width, label, result, stateIssues = []) {
  const bad = result.scrollW > result.docW || stateIssues.length > 0;
  if (bad) failures++;
  console.log(
    (bad ? "FAIL" : "ok  ") +
      "  " + String(width).padStart(4) + "px  " + label +
      (bad
        ? "  " +
          [
            ...(result.scrollW > result.docW ? [`scrollW=${result.scrollW}`, ...result.offenders] : []),
            ...stateIssues,
          ].join(" — ")
        : "")
  );
}

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    // Release the large statement/table DOM between routes so the complete
    // breakpoint matrix remains stable on memory-constrained runners.
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    // Next's development client keeps an HMR connection open, so
    // `networkidle` never arrives. The visible body plus loaded fonts are
    // the stable layout signals this regression test actually needs.
    await page.goto(BASE + route, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.locator("body").waitFor({ state: "visible" });
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });

    const expectedPath =
      route === "/account" || route === "/admin"
        ? "/sign-in"
        : new URL(BASE + route).pathname;
    const actualPath = new URL(page.url()).pathname;
    const routeLabel =
      expectedPath === new URL(BASE + route).pathname
        ? route
        : `${route} → ${expectedPath}`;
    const result = await measureOverflow(page);
    report(
      width,
      routeLabel,
      result,
      actualPath === expectedPath ? [] : [`landed on ${actualPath}`]
    );

    if (route === "/" && width <= 430) {
      const menuSummary = page.locator(".nav-mobile-summary");
      await menuSummary.click();
      const menuOpen = await page.locator(".nav-mobile-sections").getAttribute("open");
      const menuLinks = await page.locator(".nav-mobile-menu a").count();
      report(
        width,
        "/ [Sections open]",
        await measureOverflow(page),
        [
          ...(menuOpen === "" ? [] : ["Sections did not open"]),
          ...(menuLinks === 8 ? [] : [`expected 8 section links, found ${menuLinks}`]),
        ]
      );
      await menuSummary.click();

      const filtersButton = page.locator(".disclose");
      await filtersButton.click();
      const filtersExpanded = await filtersButton.getAttribute("aria-expanded");
      const mobileSortVisible = await page.locator(".field-sort-mobile").isVisible();
      report(
        width,
        "/ [Filters open]",
        await measureOverflow(page),
        [
          ...(filtersExpanded === "true" ? [] : ["Filters did not expand"]),
          ...(mobileSortVisible ? [] : ["mobile sort is not visible"]),
        ]
      );
    }
    await page.close();
  }
}

await browser.close();

if (failures) {
  console.error("\n" + failures + " route/width combinations scroll horizontally.");
  process.exit(1);
}
console.log("\nNo horizontal overflow.");
