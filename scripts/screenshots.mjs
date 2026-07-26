/**
 * Capture every route for design review.
 *   BASE=http://localhost:3000 node scripts/screenshots.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "./.screens";
const EXECUTABLE = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SHOTS = [
  ["/", "home", 1400, 1100],
  ["/?party=JLP", "home-filtered", 1400, 900],
  ["/netas", "netas", 1300, 1000],
  ["/neta/r-venkataraman", "neta", 1300, 1250],
  ["/statement/monsoon-instructed-thursday", "statement", 1400, 1200],
  ["/duel", "duel", 1400, 820],
  ["/ledger", "ledger", 1300, 950],
  ["/rules", "rules", 1300, 1000],
  ["/hall", "hall", 1300, 900],
  ["/submit", "submit", 1300, 1100],
];

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

for (const [route, name, w, h] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
  await page.close();
}

// Night Edition
const dark = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await dark.goto(BASE + "/", { waitUntil: "networkidle" });
await dark.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await dark.waitForTimeout(700);
await dark.screenshot({ path: `${OUT}/home-night.png` });
console.log("home-night");

await browser.close();
