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
const DEFAULT_ROUTES = [
  "/",
  "/watch",
  "/standings",
  "/standings?party=BJP&tier=gold",
  "/record",
  "/record?party=BJP",
  "/duel",
  "/netas",
  "/neta/narendra-modi",
  "/statement/on-ganesha-karna-and-the-antiquity-of-surgery-in-0002",
  "/statement/on-coca-cola-s-founder-as-a-shikanji-seller-in-0042",
  "/ledger",
  "/rules",
  "/submit",
  "/hall",
  "/sign-in",
  "/sign-up",
  "/account",
  "/admin",
];
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(",").map((value) => value.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

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

/**
 * Document scrollWidth alone misses overflow trapped inside a local
 * overflow:auto container (the Netas table regression was exactly that).
 * Check the named layout boundaries and their immediate children as well.
 */
async function measureLocalOverflow(page, checks) {
  return page.evaluate((localChecks) => {
    const issues = [];

    for (const check of localChecks) {
      const elements = Array.from(document.querySelectorAll(check.selector));
      if (elements.length === 0) {
        if (check.required !== false) {
          issues.push(`${check.label} is missing`);
        }
        continue;
      }

      elements.forEach((element, index) => {
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return;

        const excess = element.scrollWidth - element.clientWidth;
        if (excess <= 1) return;

        const suffix = elements.length > 1 ? `[${index + 1}]` : "";
        issues.push(
          `${check.label}${suffix} scrollW=${element.scrollWidth}, clientW=${element.clientWidth}`
        );
      });
    }

    // A handful of representative offenders is enough to diagnose a
    // failure without flooding CI logs for a long table.
    return issues.slice(0, 8);
  }, checks);
}

async function measureNetasMobileState(page) {
  return page.evaluate(() => {
    const firstRow = document.querySelector(".netas-table tbody tr");
    if (!firstRow) return ["netas table has no body row"];

    const isVisible = (element) =>
      Boolean(element && element.getBoundingClientRect().width > 0);
    const representativeCell =
      firstRow.querySelector(".entry-quote")?.closest("td") ?? null;
    const formCell = firstRow.querySelector(".formguide")?.closest("td") ?? null;
    const formHeader = document.querySelector(".netas-table thead .c-mobile-hide");
    const issues = [];

    if (!isVisible(representativeCell)) {
      issues.push("netas representative cell is hidden");
    }
    if (isVisible(formCell) && !isVisible(formHeader)) {
      issues.push("netas Form body is visible while its header is hidden");
    }
    return issues;
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

try {
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
    const localIssues =
      route === "/netas" && width <= 640
        ? [
            ...(await measureLocalOverflow(page, [
              { label: "netas table viewport", selector: ".tablewrap" },
              { label: "netas table", selector: ".netas-table" },
              { label: "netas header", selector: ".netas-table th" },
              { label: "netas cell", selector: ".netas-table td" },
              { label: "netas form guide", selector: ".netas-table .formguide" },
            ])),
            ...(await measureNetasMobileState(page)),
          ]
        : (route.startsWith("/standings") || route.startsWith("/record")) &&
            width <= 640
          ? await measureLocalOverflow(page, [
              { label: "query", selector: ".query" },
              { label: "query primary", selector: ".query-primary" },
              { label: "query primary control", selector: ".query-primary > *" },
            ])
          : route === "/submit" && width <= 640
            ? await measureLocalOverflow(page, [
                { label: "submit document", selector: ".document" },
                { label: "submit form", selector: ".document form" },
                { label: "submit form row", selector: ".document form > *" },
                { label: "timestamp grid", selector: ".submit-timestamps" },
                { label: "timestamp field", selector: ".submit-timestamps > *" },
              ])
            : [];
    report(
      width,
      routeLabel,
      result,
      [
        ...(actualPath === expectedPath ? [] : [`landed on ${actualPath}`]),
        ...localIssues,
      ]
    );

    if (route === "/" && width <= 430) {
      const menuSummary = page.locator(".nav-mobile-summary");
      await menuSummary.evaluate((element) => element.click());
      const menuOpen = await page.locator(".nav-mobile-sections").getAttribute("open");
      const menuLinks = await page.locator(".nav-mobile-menu a").count();
      report(
        width,
        "/ [Sections open]",
        await measureOverflow(page),
        [
          ...(menuOpen === "" ? [] : ["Sections did not open"]),
          ...(menuLinks === 9 ? [] : [`expected 9 section links, found ${menuLinks}`]),
        ]
      );
      await menuSummary.evaluate((element) => element.click());
    }

    if (
      (route.startsWith("/standings") || route.startsWith("/record")) &&
      width <= 640
    ) {
      const filtersButton = page.locator(".disclose");
      await filtersButton.evaluate((element) => element.click());
      const filtersExpanded = await filtersButton.getAttribute("aria-expanded");
      const mobileSortVisible = await page.locator(".field-sort-mobile").isVisible();
      const filterOverflowIssues = await measureLocalOverflow(page, [
        { label: "query with filters", selector: ".query" },
        { label: "query primary with filters", selector: ".query-primary" },
        { label: "query primary control", selector: ".query-primary > *" },
        { label: "filters grid", selector: ".filters" },
        { label: "filter field", selector: ".filters > *" },
      ]);
      report(
        width,
        `${route} [Filters open]`,
        await measureOverflow(page),
        [
          ...(filtersExpanded === "true" ? [] : ["Filters did not expand"]),
          ...(mobileSortVisible ? [] : ["mobile sort is not visible"]),
          ...filterOverflowIssues,
        ]
      );
    }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures) {
  console.error("\n" + failures + " route/width combinations scroll horizontally.");
  process.exit(1);
}
console.log("\nNo horizontal overflow.");
