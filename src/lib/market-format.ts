const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
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

export function todayInLosAngeles() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
