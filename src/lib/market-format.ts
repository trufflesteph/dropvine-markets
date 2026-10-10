const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayMs = 24 * 60 * 60 * 1000;

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value: string, days: number) {
  return new Date(parseDate(value).getTime() + days * dayMs).toISOString().slice(0, 10);
}

// "Nov 14", "Nov 14–15", "Nov 30–Dec 2"
export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates coming soon";

  const startDate = parseDate(start);
  const startLabel = `${shortMonth.format(startDate)} ${startDate.getUTCDate()}`;
  if (!end || end === start) return startLabel;

  const endDate = parseDate(end);
  const sameMonth = startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth();
  return sameMonth
    ? `${startLabel}–${endDate.getUTCDate()}`
    : `${startLabel}–${shortMonth.format(endDate)} ${endDate.getUTCDate()}`;
}

export function formatPlace(city: string, state: string, vendorCount: number) {
  const place = `${city}, ${state}`;
  if (!vendorCount) return place;
  return `${place} · ${vendorCount} ${vendorCount === 1 ? "vendor" : "vendors"}`;
}

export function todayInLosAngeles(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type MarketRun = {
  /** First day of the run, which may be before today. Use for display. */
  start: string;
  /** Last consecutive day of the run. */
  end: string;
  /** First day of the run that is today or later. Use for filtering and sorting. */
  next: string;
};

// The run of consecutive dates that contains the market's next date on or after today.
// A market on day 2 of "Nov 14, Nov 15" still reports start Nov 14 so the full range can be shown.
export function currentRun(dates: string[], today: string): MarketRun | null {
  const sorted = [...new Set(dates)].sort();
  const nextIndex = sorted.findIndex((date) => date >= today);
  if (nextIndex < 0) return null;

  let startIndex = nextIndex;
  while (startIndex > 0 && addDays(sorted[startIndex - 1], 1) === sorted[startIndex]) startIndex -= 1;
  let endIndex = nextIndex;
  while (endIndex < sorted.length - 1 && addDays(sorted[endIndex], 1) === sorted[endIndex + 1]) endIndex += 1;

  return { start: sorted[startIndex], end: sorted[endIndex], next: sorted[nextIndex] };
}

export type DateFilter = "all" | "weekend" | "month";

// The window of dates a filter covers, as inclusive YYYY-MM-DD strings, with "today" in Pacific time.
// "This weekend" runs from today through Sunday when today is Friday, Saturday, or Sunday,
// so Friday-evening and in-progress markets still count; otherwise it is the coming Saturday and Sunday.
export function dateFilterWindow(filter: Exclude<DateFilter, "all">, today: string) {
  if (filter === "month") {
    const date = parseDate(today);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { from: today, to: lastDay };
  }

  const weekday = parseDate(today).getUTCDay();
  if (weekday === 0) return { from: today, to: today };
  if (weekday >= 5) return { from: today, to: addDays(today, 7 - weekday) };
  return { from: addDays(today, 6 - weekday), to: addDays(today, 7 - weekday) };
}

// A market matches when its upcoming days (next through end) overlap the filter window.
export function isInDateFilter(next: string | null, end: string | null, filter: DateFilter, today: string) {
  if (filter === "all" || !next) return true;
  const { from, to } = dateFilterWindow(filter, today);
  return next <= to && (end ?? next) >= from;
}
