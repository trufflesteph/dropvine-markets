// The single definition of how booths are parsed, ordered, and shown. A vendor can hold several booths at one
// market; they are stored as a text[] on market_vendor_links.booth_label.

const numericBooth = /^\d+(\.\d+)?$/;

// Accepts admin or CSV input ("12, 14"), a stored array, or a pre-migration single string. Trims each booth,
// drops blanks, and drops repeats (ignoring case, keeping the first spelling as typed).
export function parseBooths(value: unknown): string[] {
  const parts = Array.isArray(value) ? value.flatMap((item) => typeof item === "string" ? item.split(",") : []) : typeof value === "string" ? value.split(",") : [];
  const seen = new Set<string>();
  const booths: string[] = [];
  for (const part of parts) {
    const booth = part.trim();
    if (!booth || seen.has(booth.toLowerCase())) continue;
    seen.add(booth.toLowerCase());
    booths.push(booth);
  }
  return booths;
}

// Numeric-looking booths first, in number order (2 before 12), then the rest alphabetically.
export function compareBooths(a: string, b: string) {
  const aNumeric = numericBooth.test(a);
  const bNumeric = numericBooth.test(b);
  if (aNumeric && bNumeric) return Number(a) - Number(b);
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function sortBooths(value: unknown) {
  return parseBooths(value).sort(compareBooths);
}

// A booth code like "12", "A12", "B-4" or "12A": short, with a digit and no spaces.
function isShortCode(booth: string) {
  return booth.length <= 6 && /\d/.test(booth) && !/\s/.test(booth);
}

// "Booth 12" or "Booths 12, 14" when every booth is a short code; otherwise the labels as written
// ("12, Near entrance"). "" when there are none (callers hide the line).
export function formatBooths(value: unknown) {
  const booths = sortBooths(value);
  if (!booths.length) return "";
  if (!booths.every(isShortCode)) return booths.join(", ");
  return `${booths.length === 1 ? "Booth" : "Booths"} ${booths.join(", ")}`;
}

// Orders vendor links by their lowest booth; links without a booth go last.
export function compareByBooths(a: unknown, b: unknown) {
  const [aFirst] = sortBooths(a);
  const [bFirst] = sortBooths(b);
  if (!aFirst || !bFirst) return aFirst ? -1 : bFirst ? 1 : 0;
  return compareBooths(aFirst, bFirst);
}

// Booths given to more than one vendor at the same market, mapped to the vendors holding them.
export function sharedBooths<Link extends { booth_label: unknown; name: string }>(links: Link[]) {
  const holders = new Map<string, { booth: string; names: string[] }>();
  for (const link of links) {
    for (const booth of parseBooths(link.booth_label)) {
      const entry = holders.get(booth.toLowerCase()) ?? { booth, names: [] };
      entry.names.push(link.name);
      holders.set(booth.toLowerCase(), entry);
    }
  }
  return [...holders.values()].filter((entry) => entry.names.length > 1);
}
