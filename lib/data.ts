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
    venue: "Heritage Symposium, Cuttack", daysAgo: 88, gp: 1868, previousRank: 4, duels: 7106,
    sources: [{ tier: "A", outlet: "Official Party Channel", url: "#" }],
    axes: { logic: 91, straightFace: 96, rewatch: 88, crowd: 74, consequence: 8 },
  },
  {
    id: 102, slug: "potato-entered-factory",
    quote: "A potato entered the factory and a diamond came out.",
    originalLines: ["একটি আলু কারখানায় ঢুকল।", "এবং একটি হীরে বেরিয়ে এল।"],
    englishLines: ["A potato entered the factory.", "And a diamond came out."],
    neta: "k-bhattacharya", category: "Economics", language: "Bengali", script: "other",
    venue: "Industrial Development Rally, Durgapur", daysAgo: 410, gp: 1829, previousRank: 2, duels: 9330,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 89, straightFace: 93, rewatch: 96, crowd: 91, consequence: 2 },
  },
  {
    id: 1834, slug: "inflation-prices-confidently",
    quote: "Inflation is merely prices behaving confidently.",
    originalLines: ["பணவீக்கம் என்பது விலைகள் நம்பிக்கையுடன் நடந்துகொள்வது மட்டுமே."],
    englishLines: ["Inflation is merely prices behaving confidently."],
    neta: "d-iyer", category: "Economics", language: "Tamil", script: "other",
    venue: "Chamber of Commerce, Coimbatore", daysAgo: 19, gp: 1790, previousRank: 11, duels: 2044,
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
    venue: "Televised Panel Discussion, Jaipur", daysAgo: 62, gp: 1742, previousRank: 5, duels: 5510,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 78, straightFace: 94, rewatch: 84, crowd: 96, consequence: 3 },
  },
  {
    id: 741, slug: "river-consulted-no-objection",
    quote: "The river was consulted and raised no objection.",
    originalLines: ["नदीशी सल्लामसलत करण्यात आली आणि तिने कोणतीही हरकत घेतली नाही."],
    englishLines: ["The river was consulted and raised no objection."],
    neta: "a-deshmukh", category: "Science & Reason", language: "Marathi", script: "deva",
    venue: "Riverfront Project Inauguration, Nashik", daysAgo: 203, gp: 1662, previousRank: 6, duels: 4188,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 92, straightFace: 88, rewatch: 71, crowd: 62, consequence: 6 },
  },
  {
    id: 903, slug: "statistics-personal-interpretation",
    quote: "Statistics are a matter of personal interpretation.",
    originalLines: ["గణాంకాలు వ్యక్తిగత వివరణకు సంబంధించిన విషయం."],
    englishLines: ["Statistics are a matter of personal interpretation."],
    neta: "m-reddy", category: "Economics", language: "Telugu", script: "other",
    venue: "Budget Session Press Briefing, Hyderabad", daysAgo: 47, gp: 1608, previousRank: 7, duels: 3902,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 88, straightFace: 91, rewatch: 66, crowd: 55, consequence: 9 },
  },
  {
    id: 1861, slug: "gravity-winter-months",
    quote: "Gravity applies chiefly in the winter months.",
    originalLines: ["ਗੁਰੂਤਾ ਖਿੱਚ ਮੁੱਖ ਤੌਰ ਤੇ ਸਰਦੀਆਂ ਵਿੱਚ ਲਾਗੂ ਹੁੰਦੀ ਹੈ।"],
    englishLines: ["Gravity applies chiefly in the winter months."],
    neta: "h-gill", category: "Science & Reason", language: "Punjabi", script: "other",
    venue: "School Science Fair, Ludhiana", daysAgo: 12, gp: 1569, previousRank: 13, duels: 1180,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 97, straightFace: 89, rewatch: 92, crowd: 41, consequence: 5 },
  },
  {
    id: 528, slug: "confidential-have-not-read",
    quote: "The report is confidential, which is why I have not read it.",
    originalLines: ["റിപ്പോർട്ട് രഹസ്യാത്മകമാണ്, അതുകൊണ്ടാണ് ഞാൻ അത് വായിക്കാത്തത്."],
    englishLines: ["The report is confidential, which is why I have not read it."],
    neta: "t-nair", category: "Standing Ovation", language: "Malayalam", script: "other",
    venue: "Assembly Question Hour, Thiruvananthapuram", daysAgo: 154, gp: 1477, previousRank: 9, duels: 3311,
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
    venue: "Annual Review Meeting, Surat", daysAgo: 96, gp: 1408, previousRank: 8, duels: 2870,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 83, straightFace: 92, rewatch: 64, crowd: 71, consequence: 7 },
  },
  {
    id: 233, slug: "history-began-1976",
    quote: "History began, broadly speaking, in 1976.",
    originalLines: ["History began, broadly speaking, in 1976."],
    englishLines: ["History began, broadly speaking, in 1976."],
    neta: "l-kaul", category: "History", language: "English", script: "latin",
    venue: "Literature Festival Panel, New Delhi", daysAgo: 271, gp: 1357, previousRank: 10, duels: 4025,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }, { tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 90, straightFace: 84, rewatch: 69, crowd: 58, consequence: 12 },
  },
  {
    id: 1799, slug: "committee-to-decide-on-committee",
    quote: "The committee has been formed to decide on forming a committee.",
    originalLines: ["ಸಮಿತಿಯನ್ನು ರಚಿಸುವ ಬಗ್ಗೆ ನಿರ್ಧರಿಸಲು ಸಮಿತಿ ರಚಿಸಲಾಗಿದೆ."],
    englishLines: ["The committee has been formed to decide on forming a committee."],
    neta: "v-rao", category: "Standing Ovation", language: "Kannada", script: "other",
    venue: "Secretariat Briefing, Bengaluru", daysAgo: 33, gp: 1288, previousRank: 12, duels: 1904,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 61, straightFace: 98, rewatch: 73, crowd: 87, consequence: 2 },
  },
  {
    id: 1120, slug: "electricity-subject-to-availability",
    quote: "Electricity is available at all times, subject to availability.",
    originalLines: deva(["बिजली हर समय उपलब्ध है,", "उपलब्धता के अधीन।"]),
    englishLines: ["Electricity is available at all times,", "subject to availability."],
    neta: "j-yadav", category: "Economics", language: "Hindi", script: "deva",
    venue: "Power Grid Commissioning, Patna", daysAgo: 71, gp: 1236, previousRank: 14, duels: 2211,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 72, straightFace: 90, rewatch: 68, crowd: 66, consequence: 5 },
  },
  {
    id: 1877, slug: "did-not-say-only-said-aloud",
    quote: "I did not say it. I only said it aloud.",
    originalLines: ["আমি এটা বলিনি। আমি শুধু জোরে বলেছি।"],
    englishLines: ["I did not say it. I only said it aloud."],
    neta: "n-bose", category: "Whataboutery", language: "Bengali", script: "other",
    venue: "Doorstep Press Interaction, Kolkata", daysAgo: 8, gp: 1200, previousRank: 15, duels: 702,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }],
    axes: { logic: 66, straightFace: 87, rewatch: 90, crowd: 44, consequence: 3 },
  },
  {
    id: 604, slug: "road-exists-on-paper",
    quote: "The road exists on paper, which is where roads begin.",
    originalLines: deva(["सड़क कागज़ पर मौजूद है,", "और सड़कें वहीं से शुरू होती हैं।"]),
    englishLines: ["The road exists on paper,", "which is where roads begin."],
    neta: "g-thakur", category: "Economics", language: "Hindi", script: "deva",
    venue: "Public Works Review, Indore", daysAgo: 188, gp: 1183, previousRank: 16, duels: 1655,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 70, straightFace: 85, rewatch: 62, crowd: 49, consequence: 6 },
  },
  {
    id: 1455, slug: "rainfall-above-average-drought",
    quote: "Rainfall was above average, allowing for the drought.",
    originalLines: deva(["वर्षा औसत से अधिक रही,", "सूखे को ध्यान में रखते हुए।"]),
    englishLines: ["Rainfall was above average,", "allowing for the drought."],
    neta: "s-mehra", category: "Science & Reason", language: "Hindi", script: "deva",
    venue: "Agricultural Board Meeting, Hisar", daysAgo: 229, gp: 1148, previousRank: 17, duels: 1120,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 81, straightFace: 79, rewatch: 55, crowd: 38, consequence: 8 },
  },
];

/**
 * Second tranche. Representatives need several entries each or the stat
 * sheet has nothing to be a sheet of — career GP equal to peak, a trophy
 * cabinet of one, a form guide of one. Accumulation is the whole point.
 */
STATEMENTS.push(
  { id: 431, slug: "clouds-and-instruments", quote: "Cloud cover interferes with instruments, which is why we chose that day.",
    originalLines: deva(["बादल यंत्रों में बाधा डालते हैं,", "इसीलिए हमने वह दिन चुना।"]),
    englishLines: ["Cloud cover interferes with instruments,", "which is why we chose that day."],
    neta: "r-venkataraman", category: "Science & Reason", language: "Hindi", script: "deva",
    venue: "Defence Correspondents' Briefing, Lucknow", daysAgo: 302, gp: 1715, previousRank: 6, duels: 6180,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 96, straightFace: 92, rewatch: 74, crowd: 69, consequence: 5 },
    citation: "For services to atmospheric physics.",
    note: "The Committee notes that the instruments in question were not specified." },

  { id: 612, slug: "department-of-weather-targets", quote: "The department has been given a rainfall target for the quarter.",
    originalLines: deva(["विभाग को तिमाही के लिए वर्षा का लक्ष्य दिया गया है।"]),
    englishLines: ["The department has been given a rainfall target for the quarter."],
    neta: "r-venkataraman", category: "Economics", language: "Hindi", script: "deva",
    venue: "Quarterly Review, Lucknow", daysAgo: 221, gp: 1514, previousRank: 11, duels: 3410,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 88, straightFace: 94, rewatch: 66, crowd: 58, consequence: 6 },
    note: "The target was subsequently described as indicative." },

  { id: 449, slug: "ancestors-and-aviation", quote: "Aviation was invented here. The paperwork was lost.",
    originalLines: ["ବିମାନ ଚଳାଚଳ ଏଠାରେ ଆବିଷ୍କୃତ ହୋଇଥିଲା।", "କାଗଜପତ୍ର ହଜିଯାଇଥିଲା।"],
    englishLines: ["Aviation was invented here.", "The paperwork was lost."],
    neta: "s-mahapatra", category: "History", language: "Odia", script: "other",
    venue: "Founders' Day Address, Bhubaneswar", daysAgo: 174, gp: 1635, previousRank: 8, duels: 5040,
    sources: [{ tier: "A", outlet: "Official Party Channel", url: "#" }],
    axes: { logic: 93, straightFace: 95, rewatch: 84, crowd: 77, consequence: 3 },
    citation: "For services to the history of flight.",
    note: "No archive has been identified." },

  { id: 508, slug: "libraries-were-cloud-storage", quote: "Libraries were simply cloud storage with stairs.",
    originalLines: ["ଲାଇବ୍ରେରୀଗୁଡ଼ିକ କେବଳ ସିଡ଼ି ସହିତ କ୍ଲାଉଡ୍ ଷ୍ଟୋରେଜ୍ ଥିଲା।"],
    englishLines: ["Libraries were simply cloud storage with stairs."],
    neta: "s-mahapatra", category: "History", language: "Odia", script: "other",
    venue: "Digital Literacy Launch, Puri", daysAgo: 58, gp: 1374, previousRank: 12, duels: 2260,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 71, straightFace: 88, rewatch: 91, crowd: 64, consequence: 7 } },

  { id: 233, slug: "factory-runs-on-optimism", quote: "The plant runs chiefly on optimism, and partly on coal.",
    originalLines: ["কারখানাটি প্রধানত আশাবাদে চলে, এবং আংশিকভাবে কয়লায়।"],
    englishLines: ["The plant runs chiefly on optimism, and partly on coal."],
    neta: "k-bhattacharya", category: "Economics", language: "Bengali", script: "other",
    venue: "Plant Commissioning, Asansol", daysAgo: 356, gp: 1588, previousRank: 9, duels: 4620,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 79, straightFace: 91, rewatch: 82, crowd: 85, consequence: 4 },
    citation: "For services to industrial thermodynamics." },

  { id: 691, slug: "unemployment-is-a-perception", quote: "Unemployment is largely a perception held by the unemployed.",
    originalLines: ["বেকারত্ব মূলত বেকারদের একটি ধারণা।"],
    englishLines: ["Unemployment is largely a perception held by the unemployed."],
    neta: "k-bhattacharya", category: "Economics", language: "Bengali", script: "other",
    venue: "Employment Summit, Kolkata", daysAgo: 129, gp: 1442, previousRank: 10, duels: 3980,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 84, straightFace: 96, rewatch: 78, crowd: 90, consequence: 2 },
    note: "The remark was made to an audience of jobseekers." },

  { id: 1902, slug: "gdp-is-a-mood", quote: "GDP is, in the final analysis, a mood.",
    originalLines: ["மொத்த உள்நாட்டு உற்பத்தி என்பது இறுதி பகுப்பாய்வில் ஒரு மனநிலை."],
    englishLines: ["GDP is, in the final analysis, a mood."],
    neta: "d-iyer", category: "Economics", language: "Tamil", script: "other",
    venue: "Economic Outlook Address, Chennai", daysAgo: 41, gp: 1551, previousRank: 9, duels: 2890,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 82, straightFace: 98, rewatch: 76, crowd: 61, consequence: 9 } },

  { id: 1776, slug: "previous-government-and-rain", quote: "The previous government also had weather. Nobody asked them about it.",
    originalLines: deva(["पिछली सरकार के पास भी मौसम था।", "किसी ने उनसे नहीं पूछा।"]),
    englishLines: ["The previous government also had weather.", "Nobody asked them about it."],
    neta: "p-chauhan", category: "Whataboutery", language: "Hindi", script: "deva",
    venue: "Press Conference, Jodhpur", daysAgo: 24, gp: 1688, previousRank: 8, duels: 3120,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 74, straightFace: 93, rewatch: 89, crowd: 94, consequence: 1 },
    citation: "For sustained excellence in deflection." },

  { id: 1544, slug: "question-is-the-real-question", quote: "Before answering, we must ask who benefits from the question.",
    originalLines: deva(["उत्तर देने से पहले हमें पूछना चाहिए", "कि इस प्रश्न से किसे लाभ है।"]),
    englishLines: ["Before answering, we must ask", "who benefits from the question."],
    neta: "p-chauhan", category: "Whataboutery", language: "Hindi", script: "deva",
    venue: "Televised Debate, Jaipur", daysAgo: 111, gp: 1425, previousRank: 13, duels: 2540,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }, { tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 68, straightFace: 90, rewatch: 80, crowd: 88, consequence: 3 } },

  { id: 822, slug: "mountain-was-informed", quote: "The mountain was informed of the tunnel well in advance.",
    originalLines: ["बोगद्याबद्दल पर्वताला आगाऊ कळवण्यात आले होते."],
    englishLines: ["The mountain was informed of the tunnel well in advance."],
    neta: "a-deshmukh", category: "Science & Reason", language: "Marathi", script: "deva",
    venue: "Infrastructure Review, Pune", daysAgo: 88, gp: 1532, previousRank: 10, duels: 3050,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 94, straightFace: 87, rewatch: 79, crowd: 55, consequence: 5 } },

  { id: 1188, slug: "numbers-were-revised-upward-emotionally", quote: "The figures have been revised upward, emotionally.",
    originalLines: ["గణాంకాలు భావోద్వేగపరంగా పైకి సవరించబడ్డాయి."],
    englishLines: ["The figures have been revised upward, emotionally."],
    neta: "m-reddy", category: "Economics", language: "Telugu", script: "other",
    venue: "Statistics Bureau Briefing, Hyderabad", daysAgo: 66, gp: 1458, previousRank: 11, duels: 2740,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 86, straightFace: 95, rewatch: 72, crowd: 60, consequence: 8 },
    note: "A revised figure was not subsequently issued." },

  { id: 1933, slug: "winter-and-the-thermometer", quote: "The thermometer is being replaced, which should improve the temperature.",
    originalLines: ["ਥਰਮਾਮੀਟਰ ਬਦਲਿਆ ਜਾ ਰਿਹਾ ਹੈ, ਜਿਸ ਨਾਲ ਤਾਪਮਾਨ ਸੁਧਰਨਾ ਚਾਹੀਦਾ ਹੈ।"],
    englishLines: ["The thermometer is being replaced, which should improve the temperature."],
    neta: "h-gill", category: "Science & Reason", language: "Punjabi", script: "other",
    venue: "Civic Facilities Inspection, Amritsar", daysAgo: 6, gp: 1495, previousRank: 0, duels: 940,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 95, straightFace: 86, rewatch: 88, crowd: 47, consequence: 4 } },

  { id: 977, slug: "read-the-summary-of-the-summary", quote: "I have read the summary of the summary, which is the important part.",
    originalLines: ["ഞാൻ സംഗ്രഹത്തിന്റെ സംഗ്രഹം വായിച്ചു, അതാണ് പ്രധാന ഭാഗം."],
    englishLines: ["I have read the summary of the summary, which is the important part."],
    neta: "t-nair", category: "Standing Ovation", language: "Malayalam", script: "other",
    venue: "Committee Hearing, Kochi", daysAgo: 77, gp: 1391, previousRank: 12, duels: 2410,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 70, straightFace: 92, rewatch: 74, crowd: 89, consequence: 2 } },

  { id: 1345, slug: "achievement-ahead-of-schedule", quote: "The project is ahead of schedule, once the schedule is revised.",
    originalLines: ["શેડ્યૂલમાં સુધારો કર્યા પછી પ્રોજેક્ટ સમય કરતાં આગળ છે."],
    englishLines: ["The project is ahead of schedule, once the schedule is revised."],
    neta: "b-solanki", category: "Economics", language: "Gujarati", script: "other",
    venue: "Site Inspection, Ahmedabad", daysAgo: 39, gp: 1323, previousRank: 14, duels: 1880,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 77, straightFace: 90, rewatch: 70, crowd: 66, consequence: 6 } },

  { id: 1466, slug: "the-nineties-are-a-construct", quote: "The nineteen-nineties are, strictly speaking, a construct.",
    originalLines: ["The nineteen-nineties are, strictly speaking, a construct."],
    englishLines: ["The nineteen-nineties are, strictly speaking, a construct."],
    neta: "l-kaul", category: "History", language: "English", script: "latin",
    venue: "Panel Discussion, New Delhi", daysAgo: 143, gp: 1270, previousRank: 15, duels: 2120,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }, { tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 80, straightFace: 83, rewatch: 68, crowd: 52, consequence: 10 } },

  { id: 1690, slug: "subcommittee-of-the-subcommittee", quote: "A subcommittee has been appointed to review the committee's pace.",
    originalLines: ["ಸಮಿತಿಯ ವೇಗವನ್ನು ಪರಿಶೀಲಿಸಲು ಉಪಸಮಿತಿಯನ್ನು ನೇಮಿಸಲಾಗಿದೆ."],
    englishLines: ["A subcommittee has been appointed to review the committee's pace."],
    neta: "v-rao", category: "Standing Ovation", language: "Kannada", script: "other",
    venue: "Secretariat Briefing, Mysuru", daysAgo: 15, gp: 1340, previousRank: 0, duels: 1240,
    sources: [{ tier: "A", outlet: "State Assembly Feed", url: "#" }],
    axes: { logic: 64, straightFace: 97, rewatch: 81, crowd: 91, consequence: 1 } },

  { id: 1055, slug: "power-cut-is-a-scheduled-pause", quote: "There are no power cuts. There are scheduled pauses.",
    originalLines: deva(["बिजली कटौती नहीं है।", "निर्धारित विराम हैं।"]),
    englishLines: ["There are no power cuts.", "There are scheduled pauses."],
    neta: "j-yadav", category: "Economics", language: "Hindi", script: "deva",
    venue: "Grid Review, Muzaffarpur", daysAgo: 104, gp: 1306, previousRank: 14, duels: 2020,
    sources: [{ tier: "A", outlet: "Ministry Press Bureau", url: "#" }],
    axes: { logic: 73, straightFace: 93, rewatch: 77, crowd: 70, consequence: 4 } },

  { id: 1810, slug: "clarification-of-the-clarification", quote: "My clarification has been misunderstood. I will clarify it.",
    originalLines: ["আমার ব্যাখ্যা ভুল বোঝা হয়েছে। আমি এটি ব্যাখ্যা করব।"],
    englishLines: ["My clarification has been misunderstood. I will clarify it."],
    neta: "n-bose", category: "Whataboutery", language: "Bengali", script: "other",
    venue: "Doorstep Interaction, Howrah", daysAgo: 3, gp: 1253, previousRank: 0, duels: 480,
    sources: [{ tier: "C", outlet: "Verified Journalist Account", url: "#" }],
    axes: { logic: 62, straightFace: 89, rewatch: 93, crowd: 48, consequence: 2 } },

  { id: 744, slug: "bridge-is-conceptually-complete", quote: "The bridge is conceptually complete.",
    originalLines: deva(["पुल वैचारिक रूप से पूर्ण है।"]),
    englishLines: ["The bridge is conceptually complete."],
    neta: "g-thakur", category: "Economics", language: "Hindi", script: "deva",
    venue: "Works Department Review, Bhopal", daysAgo: 92, gp: 1218, previousRank: 15, duels: 1490,
    sources: [{ tier: "B", outlet: "Regional News Network", url: "#" }],
    axes: { logic: 75, straightFace: 88, rewatch: 79, crowd: 53, consequence: 5 } },

  { id: 1281, slug: "average-includes-the-exceptions", quote: "The average is satisfactory once the exceptions are excluded.",
    originalLines: deva(["अपवादों को हटाने के बाद औसत संतोषजनक है।"]),
    englishLines: ["The average is satisfactory once the exceptions are excluded."],
    neta: "s-mehra", category: "Science & Reason", language: "Hindi", script: "deva",
    venue: "Agricultural Board Meeting, Rohtak", daysAgo: 160, gp: 1166, previousRank: 16, duels: 1280,
    sources: [{ tier: "B", outlet: "National Broadcast", url: "#" }],
    axes: { logic: 83, straightFace: 81, rewatch: 58, crowd: 42, consequence: 7 } }
);

/** Citations and notes for the first tranche. */
STATEMENTS[0].citation = "For services to meteorology.";
STATEMENTS[0].note = "No corresponding departmental order has been produced.";
STATEMENTS[1].citation = "For services to telecommunications history.";
STATEMENTS[2].citation = "For services to materials science.";
STATEMENTS[2].note = "The Committee has been unable to verify the potato.";
STATEMENTS[3].citation = "For services to monetary policy.";
STATEMENTS[4].citation = "For distinguished service to the art of the counter-question.";
STATEMENTS[5].note = "The river has not responded to our request for comment.";
STATEMENTS[8].note = "The audience applauded for eleven seconds.";

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
