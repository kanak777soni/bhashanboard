import type { LedgerEntry, Neta, Party, Statement } from "./types";

/**
 * SEED DATA — ENTIRELY FICTIONAL.
 *
 * Every representative, party and statement below is invented for
 * development. Nothing here is a real quote and no real person is
 * referenced. Publishing a fabricated statement attributed to a real
 * politician is the single thing this project must never do
 * (docs/01-concept.md §1.2, docs/04-legal-and-safety.md §4.1).
 *
 * This module is the seam where Postgres goes later. Keep every read
 * behind the accessor functions at the bottom so swapping the store
 * touches nothing else.
 */

export const PARTIES: Party[] = [
  { code: "UPM", name: "United Progress Manch", ink: "#3E6B8A" },
  { code: "NSD", name: "Navrashtra Dal", ink: "#8E2230" },
  { code: "JLP", name: "Jan Lok Party", ink: "#2C6B4E" },
  { code: "RKD", name: "Rashtriya Karyakarta Dal", ink: "#A9853A" },
  { code: "VSM", name: "Vikas Samaj Morcha", ink: "#6B5B8A" },
];

export const NETAS: Neta[] = [
  { slug: "r-venkataraman", name: "R. Venkataraman", office: "Minister for Seasonal Affairs", party: "UPM", state: "Uttar Pradesh", arc: [1480, 1512, 1604, 1688, 1742, 1810, 1888, 1947], replied: true },
  { slug: "s-mahapatra", name: "S. Mahapatra", office: "Member of Parliament", party: "NSD", state: "Odisha", arc: [1502, 1556, 1622, 1701, 1766, 1844, 1921], replied: false },
  { slug: "k-bhattacharya", name: "K. Bhattacharya", office: "Member of Legislative Assembly", party: "JLP", state: "West Bengal", arc: [1466, 1590, 1655, 1733, 1802, 1918], replied: false },
  { slug: "d-iyer", name: "D. Iyer", office: "Minister for Fiscal Optimism", party: "RKD", state: "Tamil Nadu", arc: [1520, 1588, 1644, 1729, 1890], replied: true },
  { slug: "p-chauhan", name: "P. Chauhan", office: "Party Spokesperson", party: "VSM", state: "Rajasthan", arc: [1498, 1540, 1611, 1700, 1788, 1871], replied: false },
  { slug: "a-deshmukh", name: "A. Deshmukh", office: "Member of Parliament", party: "UPM", state: "Maharashtra", arc: [1477, 1533, 1602, 1699, 1802], replied: false },
  { slug: "m-reddy", name: "M. Reddy", office: "Minister for Statistical Confidence", party: "NSD", state: "Telangana", arc: [1510, 1566, 1640, 1712, 1774], replied: false },
  { slug: "h-gill", name: "H. Gill", office: "Member of Legislative Assembly", party: "JLP", state: "Punjab", arc: [1495, 1548, 1622, 1751], replied: false },
  { slug: "t-nair", name: "T. Nair", office: "Member of Parliament", party: "RKD", state: "Kerala", arc: [1488, 1544, 1610, 1698], replied: true },
  { slug: "b-solanki", name: "B. Solanki", office: "Minister for Target Achievement", party: "VSM", state: "Gujarat", arc: [1503, 1561, 1655], replied: false },
  { slug: "l-kaul", name: "L. Kaul", office: "Member of Parliament", party: "UPM", state: "Delhi", arc: [1470, 1522, 1580, 1612], replied: false },
  { slug: "v-rao", name: "V. Rao", office: "Chair, Committee on Committees", party: "NSD", state: "Karnataka", arc: [1512, 1530, 1548], replied: false },
  { slug: "j-yadav", name: "J. Yadav", office: "Minister for Continuous Power", party: "JLP", state: "Bihar", arc: [1494, 1502], replied: false },
  { slug: "n-bose", name: "N. Bose", office: "Party Spokesperson", party: "RKD", state: "West Bengal", arc: [1470, 1441], replied: false },
  { slug: "g-thakur", name: "G. Thakur", office: "Member of Legislative Assembly", party: "VSM", state: "Madhya Pradesh", arc: [1420, 1388], replied: false },
  { slug: "s-mehra", name: "S. Mehra", office: "Member of Parliament", party: "UPM", state: "Haryana", arc: [1330, 1274], replied: false },
];

export const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
] as const;

function deva(lines: string[]) {
  return lines;
}

export const STATEMENTS: Statement[] = [
  {
    id: 417, slug: "monsoon-instructed-thursday",
    quote: "The monsoon has been instructed to arrive on Thursday.",
    originalLines: deva([
      "देखिए, मैंने विभाग से स्पष्ट कह दिया है।",
      "मानसून को गुरुवार आने के निर्देश दे दिए गए हैं।",
      "अब यह उनकी जिम्मेदारी है, हमारी नहीं।",
    ]),
    englishLines: [
      "Look, I have made it clear to the department.",
      "The monsoon has been instructed to arrive on Thursday.",
      "It is now their responsibility, not ours.",
    ],
    neta: "r-venkataraman", category: "Science & Reason", language: "Hindi", script: "deva",
    venue: "District Convention Hall, Meerut", daysAgo: 136, gp: 1947, previousRank: 1, duels: 8412,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }, { tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 94, straightFace: 99, rewatch: 81, crowd: 88, consequence: 4 },
    reply: "The Hon'ble Member's office states that the remark was intended in a lighter spirit and that no directive was issued to the monsoon. We have pinned this response above the ruling, unedited, because we are aggressively fair. The rating is unchanged, because so is the video.",
  },
  {
    id: 388, slug: "ancestors-had-broadband",
    quote: "Our ancestors had broadband. It simply went unrecorded.",
    originalLines: ["ଆମ ପୂର୍ବପୁରୁଷଙ୍କ ପାଖରେ ବ୍ରଡ଼ବ୍ୟାଣ୍ଡ ଥିଲା।", "ଏହା କେବଳ ଲିପିବଦ୍ଧ ହୋଇନଥିଲା।"],
    englishLines: ["Our ancestors had broadband.", "It simply went unrecorded."],
    neta: "s-mahapatra", category: "History", language: "Odia", script: "other",
    venue: "Heritage Symposium, Cuttack", daysAgo: 88, gp: 1921, previousRank: 4, duels: 7106,
    sources: [{ tier: "A", outlet: "Official Party Channel", url: "#" }],
    axes: { logic: 91, straightFace: 96, rewatch: 88, crowd: 74, consequence: 8 },
  },
  {
    id: 102, slug: "potato-entered-factory",
    quote: "A potato entered the factory and a diamond came out.",
    originalLines: ["একটি আলু কারখানায় ঢুকল।", "এবং একটি হীরে বেরিয়ে এল।"],
    englishLines: ["A potato entered the factory.", "And a diamond came out."],
    neta: "k-bhattacharya", category: "Economics", language: "Bengali", script: "other",
    venue: "Industrial Development Rally, Durgapur", daysAgo: 410, gp: 1918, previousRank: 2, duels: 9330,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 89, straightFace: 93, rewatch: 96, crowd: 91, consequence: 2 },
  },
  {
    id: 1834, slug: "inflation-prices-confidently",
    quote: "Inflation is merely prices behaving confidently.",
    originalLines: ["பணவீக்கம் என்பது விலைகள் நம்பிக்கையுடன் நடந்துகொள்வது மட்டுமே."],
    englishLines: ["Inflation is merely prices behaving confidently."],
    neta: "d-iyer", category: "Economics", language: "Tamil", script: "other",
    venue: "Chamber of Commerce, Coimbatore", daysAgo: 19, gp: 1890, previousRank: 11, duels: 2044,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 86, straightFace: 97, rewatch: 79, crowd: 68, consequence: 11 },
    reply: "The Minister's office notes that the observation was made in the context of a broader discussion on market sentiment.",
  },
  {
    id: 655, slug: "previous-government-also-existed",
    quote: "Why discuss unemployment when the previous government also existed?",
    originalLines: deva(["बेरोज़गारी की बात क्यों करें", "जब पिछली सरकार भी अस्तित्व में थी?"]),
    englishLines: ["Why discuss unemployment", "when the previous government also existed?"],
    neta: "p-chauhan", category: "Whataboutery", language: "Hindi", script: "deva",
    venue: "Televised Panel Discussion, Jaipur", daysAgo: 62, gp: 1871, previousRank: 5, duels: 5510,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 78, straightFace: 94, rewatch: 84, crowd: 96, consequence: 3 },
  },
  {
    id: 741, slug: "river-consulted-no-objection",
    quote: "The river was consulted and raised no objection.",
    originalLines: ["नदीशी सल्लामसलत करण्यात आली आणि तिने कोणतीही हरकत घेतली नाही."],
    englishLines: ["The river was consulted and raised no objection."],
    neta: "a-deshmukh", category: "Science & Reason", language: "Marathi", script: "deva",
    venue: "Riverfront Project Inauguration, Nashik", daysAgo: 203, gp: 1802, previousRank: 6, duels: 4188,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 92, straightFace: 88, rewatch: 71, crowd: 62, consequence: 6 },
  },
  {
    id: 903, slug: "statistics-personal-interpretation",
    quote: "Statistics are a matter of personal interpretation.",
    originalLines: ["గణాంకాలు వ్యక్తిగత వివరణకు సంబంధించిన విషయం."],
    englishLines: ["Statistics are a matter of personal interpretation."],
    neta: "m-reddy", category: "Economics", language: "Telugu", script: "other",
    venue: "Budget Session Press Briefing, Hyderabad", daysAgo: 47, gp: 1774, previousRank: 7, duels: 3902,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 88, straightFace: 91, rewatch: 66, crowd: 55, consequence: 9 },
  },
  {
    id: 1861, slug: "gravity-winter-months",
    quote: "Gravity applies chiefly in the winter months.",
    originalLines: ["ਗੁਰੂਤਾ ਖਿੱਚ ਮੁੱਖ ਤੌਰ ਤੇ ਸਰਦੀਆਂ ਵਿੱਚ ਲਾਗੂ ਹੁੰਦੀ ਹੈ।"],
    englishLines: ["Gravity applies chiefly in the winter months."],
    neta: "h-gill", category: "Science & Reason", language: "Punjabi", script: "other",
    venue: "School Science Fair, Ludhiana", daysAgo: 12, gp: 1751, previousRank: 13, duels: 1180,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 97, straightFace: 89, rewatch: 92, crowd: 41, consequence: 5 },
  },
  {
    id: 528, slug: "confidential-have-not-read",
    quote: "The report is confidential, which is why I have not read it.",
    originalLines: ["റിപ്പോർട്ട് രഹസ്യാത്മകമാണ്, അതുകൊണ്ടാണ് ഞാൻ അത് വായിക്കാത്തത്."],
    englishLines: ["The report is confidential, which is why I have not read it."],
    neta: "t-nair", category: "Standing Ovation", language: "Malayalam", script: "other",
    venue: "Assembly Question Hour, Thiruvananthapuram", daysAgo: 154, gp: 1698, previousRank: 9, duels: 3311,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 74, straightFace: 95, rewatch: 77, crowd: 93, consequence: 1 },
    reply: "The Member's office clarifies that the report has since been read.",
  },
  {
    id: 1290, slug: "doubled-target-and-achievement",
    quote: "We have doubled the target and therefore also the achievement.",
    originalLines: ["અમે લક્ષ્ય બમણું કર્યું છે અને તેથી સિદ્ધિ પણ બમણી થઈ છે."],
    englishLines: ["We have doubled the target and therefore also the achievement."],
    neta: "b-solanki", category: "Economics", language: "Gujarati", script: "other",
    venue: "Annual Review Meeting, Surat", daysAgo: 96, gp: 1655, previousRank: 8, duels: 2870,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 83, straightFace: 92, rewatch: 64, crowd: 71, consequence: 7 },
  },
  {
    id: 233, slug: "history-began-1976",
    quote: "History began, broadly speaking, in 1976.",
    originalLines: ["History began, broadly speaking, in 1976."],
    englishLines: ["History began, broadly speaking, in 1976."],
    neta: "l-kaul", category: "History", language: "English", script: "latin",
    venue: "Literature Festival Panel, New Delhi", daysAgo: 271, gp: 1612, previousRank: 10, duels: 4025,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }, { tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 90, straightFace: 84, rewatch: 69, crowd: 58, consequence: 12 },
  },
  {
    id: 1799, slug: "committee-to-decide-on-committee",
    quote: "The committee has been formed to decide on forming a committee.",
    originalLines: ["ಸಮಿತಿಯನ್ನು ರಚಿಸುವ ಬಗ್ಗೆ ನಿರ್ಧರಿಸಲು ಸಮಿತಿ ರಚಿಸಲಾಗಿದೆ."],
    englishLines: ["The committee has been formed to decide on forming a committee."],
    neta: "v-rao", category: "Standing Ovation", language: "Kannada", script: "other",
    venue: "Secretariat Briefing, Bengaluru", daysAgo: 33, gp: 1548, previousRank: 12, duels: 1904,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 61, straightFace: 98, rewatch: 73, crowd: 87, consequence: 2 },
  },
  {
    id: 1120, slug: "electricity-subject-to-availability",
    quote: "Electricity is available at all times, subject to availability.",
    originalLines: deva(["बिजली हर समय उपलब्ध है,", "उपलब्धता के अधीन।"]),
    englishLines: ["Electricity is available at all times,", "subject to availability."],
    neta: "j-yadav", category: "Economics", language: "Hindi", script: "deva",
    venue: "Power Grid Commissioning, Patna", daysAgo: 71, gp: 1502, previousRank: 14, duels: 2211,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 72, straightFace: 90, rewatch: 68, crowd: 66, consequence: 5 },
  },
  {
    id: 1877, slug: "did-not-say-only-said-aloud",
    quote: "I did not say it. I only said it aloud.",
    originalLines: ["আমি এটা বলিনি। আমি শুধু জোরে বলেছি।"],
    englishLines: ["I did not say it. I only said it aloud."],
    neta: "n-bose", category: "Whataboutery", language: "Bengali", script: "other",
    venue: "Doorstep Press Interaction, Kolkata", daysAgo: 8, gp: 1441, previousRank: 15, duels: 702,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }],
    axes: { logic: 66, straightFace: 87, rewatch: 90, crowd: 44, consequence: 3 },
  },
  {
    id: 604, slug: "road-exists-on-paper",
    quote: "The road exists on paper, which is where roads begin.",
    originalLines: deva(["सड़क कागज़ पर मौजूद है,", "और सड़कें वहीं से शुरू होती हैं।"]),
    englishLines: ["The road exists on paper,", "which is where roads begin."],
    neta: "g-thakur", category: "Economics", language: "Hindi", script: "deva",
    venue: "Public Works Review, Indore", daysAgo: 188, gp: 1388, previousRank: 16, duels: 1655,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 70, straightFace: 85, rewatch: 62, crowd: 49, consequence: 6 },
  },
  {
    id: 1455, slug: "rainfall-above-average-drought",
    quote: "Rainfall was above average, allowing for the drought.",
    originalLines: deva(["वर्षा औसत से अधिक रही,", "सूखे को ध्यान में रखते हुए।"]),
    englishLines: ["Rainfall was above average,", "allowing for the drought."],
    neta: "s-mehra", category: "Science & Reason", language: "Hindi", script: "deva",
    venue: "Agricultural Board Meeting, Hisar", daysAgo: 229, gp: 1274, previousRank: 17, duels: 1120,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 81, straightFace: 79, rewatch: 55, crowd: 38, consequence: 8 },
  },
];

/** Entries still collecting placement duels — shown in the rail and ticker. */
export const IN_PLACEMENT: Statement[] = [
  {
    id: 1849, slug: "file-moved-to-safer-file",
    quote: "The file has been moved to a safer file.",
    originalLines: deva(["फ़ाइल को एक सुरक्षित फ़ाइल में डाल दिया गया है।"]),
    englishLines: ["The file has been moved to a safer file."],
    neta: "v-rao", category: "Standing Ovation", language: "Hindi", script: "deva",
    venue: "Records Department Briefing", daysAgo: 1, gp: 1500, previousRank: 0, duels: 4,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 0, straightFace: 0, rewatch: 0, crowd: 0, consequence: 0 },
    placement: 4, projected: "gold",
  },
  {
    id: 1850, slug: "budget-is-a-feeling",
    quote: "A budget is, at the end of the day, a feeling.",
    originalLines: ["A budget is, at the end of the day, a feeling."],
    englishLines: ["A budget is, at the end of the day, a feeling."],
    neta: "d-iyer", category: "Economics", language: "English", script: "latin",
    venue: "Post-Budget Interview", daysAgo: 1, gp: 1500, previousRank: 0, duels: 12,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 0, straightFace: 0, rewatch: 0, crowd: 0, consequence: 0 },
    placement: 12, projected: "diamond",
  },
  {
    id: 1851, slug: "sea-has-been-warned",
    quote: "The sea has been warned.",
    originalLines: ["കടലിന് മുന്നറിയിപ്പ് നൽകിയിട്ടുണ്ട്."],
    englishLines: ["The sea has been warned."],
    neta: "t-nair", category: "Science & Reason", language: "Malayalam", script: "other",
    venue: "Coastal Erosion Review", daysAgo: 2, gp: 1500, previousRank: 0, duels: 18,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 0, straightFace: 0, rewatch: 0, crowd: 0, consequence: 0 },
    placement: 18, projected: "kohinoor",
  },
];

export const LEDGER: LedgerEntry[] = [
  { date: "2026-07-24", kind: "withdrawal", detail: "Entry No. 01802 withdrawn. The clip was found to be a re-upload with a cut that changed the sense of the remark. No Tier A or B source could be located." },
  { date: "2026-07-22", kind: "correction", detail: "Entry No. 00417 — Hindi transcript line 2 corrected following a reader submission. Rating unaffected." },
  { date: "2026-07-19", kind: "reply", detail: "Right of reply received from the office of D. Iyer regarding Entry No. 01834. Pinned above the ruling, unedited." },
  { date: "2026-07-15", kind: "integrity", detail: "41,208 advisory ballots discounted, originating from 2,140 accounts created within the same nine-minute window. Party attribution of discounted ballots: 38% / 33% / 29%. Once again, admirably balanced." },
  { date: "2026-07-01", kind: "audit", detail: "June neutrality audit published. Rolling-100 party distribution: UPM 31%, NSD 29%, JLP 18%, RKD 15%, VSM 7%. No party exceeded the 40% ceiling. This month we disappointed everyone equally." },
  { date: "2026-06-28", kind: "withdrawal", detail: "Entry No. 01766 withdrawn. On review the remark concerned the representative's personal life and fell outside the Rules of the Committee." },
  { date: "2026-06-11", kind: "correction", detail: "Entry No. 00102 — venue corrected from Asansol to Durgapur." },
];

// ── accessors ────────────────────────────────────────────────────────
// Every read goes through these so the Postgres swap is contained.

export function allStatements(): Statement[] {
  return STATEMENTS;
}

export function rankedStatements(): Statement[] {
  return [...STATEMENTS].sort((a, b) => b.gp - a.gp);
}

export function rankOf(slug: string): number {
  return rankedStatements().findIndex((s) => s.slug === slug) + 1;
}

export function statementBySlug(slug: string): Statement | undefined {
  return [...STATEMENTS, ...IN_PLACEMENT].find((s) => s.slug === slug);
}

export function netaBySlug(slug: string): Neta | undefined {
  return NETAS.find((n) => n.slug === slug);
}

export function partyByCode(code: string): Party | undefined {
  return PARTIES.find((p) => p.code === code);
}

export function statementsByNeta(slug: string): Statement[] {
  return rankedStatements().filter((s) => s.neta === slug);
}

export function states(): string[] {
  return [...new Set(NETAS.map((n) => n.state))].sort();
}

export function languages(): string[] {
  return [...new Set(STATEMENTS.map((s) => s.language))].sort();
}

/** Rolling party distribution — the parity meter, docs/01-concept.md §1.5. */
export function parity(): { code: string; pct: number; ink: string }[] {
  const counts = new Map<string, number>();
  for (const s of STATEMENTS) {
    const neta = netaBySlug(s.neta);
    if (!neta) continue;
    counts.set(neta.party, (counts.get(neta.party) ?? 0) + 1);
  }
  const total = STATEMENTS.length || 1;
  return PARTIES.map((p) => ({
    code: p.code,
    ink: p.ink,
    pct: Math.round(((counts.get(p.code) ?? 0) / total) * 100),
  }));
}

export const EDITION = { number: "CDXVII", date: "26 July 2026" };
