// Shared NHL API helpers for the Netlify functions.
export const STATS = "https://api.nhle.com/stats/rest/en/skater/summary";
export const WEB = "https://api-web.nhle.com/v1";

// Dates in NHL "hockey time" (Eastern).
export const etDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
};

// NHL season ID for an ET date ("2026-10-16" -> "20262027"); seasons switch on September 1.
export const seasonId = (date = etDate()) => {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 9 ? y : y - 1;
  return `${start}${start + 1}`;
};

export const getJson = async (url) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if ([429, 500, 502, 503, 504].includes(r.status) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    throw new Error(`${r.status} ${url}`);
  }
};

// The stats REST endpoint now caps a page at 100 rows even when limit=-1 is requested.
// Fetch sequentially to avoid the NHL API's burst rate limit.
export const getStats = async (cayenneExp, extra = "") => {
  const limit = 100;
  const all = [];
  for (let start = 0; ; start += limit) {
    const page = await getJson(
      `${STATS}?limit=${limit}&start=${start}${extra ? `&${extra}` : ""}&cayenneExp=${encodeURIComponent(cayenneExp)}`
    );
    all.push(...(page.data ?? []));
    if (all.length >= (page.total ?? all.length) || (page.data?.length ?? 0) < limit) break;
  }
  return { data: all, total: all.length };
};

// Every skater game line on one date (regular season), one row per player.
export const gameLines = (date) =>
  getStats(
    `gameDate>="${date}" and gameDate<="${date}" and gameTypeId=2`,
    "isGame=true"
  );
