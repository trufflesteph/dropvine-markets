// Pure spotlight rules shared by the admin, the public pages, and the tests: slugs, body parsing, video URLs,
// and the homepage carousel layout. No data fetching here.

import { formatDateRange } from "./market-format.ts";

export const spotlightSummaryMax = 200;
export const spotlightMaxPhotos = 4;
export const spotlightMaxLinks = 4;
export const spotlightImageMaxBytes = 4 * 1024 * 1024;
export const spotlightImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"] as const;

export type SpotlightPhoto = { url: string; alt: string; caption: string | null };
export type SpotlightLink = { label: string; url: string };
export type SpotlightStatus = "draft" | "published";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMaxLength = 80;

// "Clay & Co.: Café Mugs" → "clay-and-co-cafe-mugs". Accents are folded to plain letters; empty input gives "".
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, slugMaxLength)
    .replace(/-+$/g, "");
}

export function isValidSlug(value: string) {
  return value.length <= slugMaxLength && slugPattern.test(value);
}

export type BodyBlock = { type: "paragraph" | "heading"; text: string };

// Plain text in, blocks out. Blank lines separate paragraphs; a line starting "## " is a subheading on its own.
// Single line breaks inside a paragraph are kept as "\n" (rendered with pre-line). Nothing is parsed as HTML or links.
export function parseBody(body: string | null | undefined): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  };
  for (const rawLine of (body ?? "").split(/\r\n|\r|\n/)) {
    const line = rawLine.trimEnd();
    // trimEnd has already turned a bare "## " into "##": an empty subheading, which is dropped.
    if (/^##(\s|$)/.test(line.trimStart())) {
      flush();
      const text = line.trimStart().slice(2).trim();
      if (text) blocks.push({ type: "heading", text });
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export type VideoInfo =
  | { kind: "youtube"; id: string; embedUrl: string; url: string }
  | { kind: "vimeo"; id: string; embedUrl: string; url: string }
  | { kind: "link"; site: string; url: string };

const knownSites: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.watch$/, "Facebook"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
];

const youtubeId = /^[A-Za-z0-9_-]{11}$/;

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function youtubeVideoId(url: URL) {
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") return parts[0];
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return undefined;
  if (url.pathname === "/watch") return url.searchParams.get("v") ?? undefined;
  if (["embed", "shorts", "live", "v"].includes(parts[0])) return parts[1];
  return undefined;
}

function vimeoVideo(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => /^\d+$/.test(part));
  if (index < 0) return undefined;
  // Unlisted videos carry a privacy hash: vimeo.com/123/abc or player.vimeo.com/video/123?h=abc.
  const hash = url.searchParams.get("h") ?? (host === "vimeo.com" && /^[a-f0-9]+$/i.test(parts[index + 1] ?? "") ? parts[index + 1] : null);
  return { id: parts[index], hash };
}

// "Instagram", "LinkedIn", … for known sites; otherwise the bare host name ("example.com").
export function videoSiteName(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  return knownSites.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

// YouTube and Vimeo get privacy-friendly embed URLs (youtube-nocookie.com, Vimeo dnt=1); anything else is a link.
// Returns null for blank or non-http(s) input.
export function classifyVideoUrl(value: string | null | undefined): VideoInfo | null {
  if (!value?.trim()) return null;
  const url = parseHttpUrl(value);
  if (!url) return null;

  const youtube = youtubeVideoId(url);
  if (youtube && youtubeId.test(youtube)) {
    return { kind: "youtube", id: youtube, embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`, url: url.toString() };
  }
  const vimeo = vimeoVideo(url);
  if (vimeo) {
    const params = new URLSearchParams({ dnt: "1", autoplay: "1" });
    if (vimeo.hash) params.set("h", vimeo.hash);
    return { kind: "vimeo", id: vimeo.id, embedUrl: `https://player.vimeo.com/video/${vimeo.id}?${params}`, url: url.toString() };
  }
  return { kind: "link", site: videoSiteName(url), url: url.toString() };
}

export function isHttpUrl(value: string) {
  return parseHttpUrl(value) !== null;
}

export type AppearanceLink = {
  booth_label: unknown;
  markets: { slug: string; name: string; market_dates: { date: string; is_canceled: boolean | null }[] | null } | null;
};
export type Appearance = { slug: string; name: string; dates: string[]; booths: unknown };

// "Find them at": markets the vendor is linked to with at least one uncanceled date today or later (YYYY-MM-DD,
// Pacific). Markets the public can't see arrive as null and are dropped. Soonest first.
export function upcomingAppearances(links: AppearanceLink[], today: string): Appearance[] {
  return links
    .flatMap((link) => {
      if (!link.markets) return [];
      const dates = [...new Set((link.markets.market_dates ?? []).filter((row) => !row.is_canceled && row.date >= today).map((row) => row.date))].sort();
      return dates.length ? [{ slug: link.markets.slug, name: link.markets.name, dates, booths: link.booth_label }] : [];
    })
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.name.localeCompare(b.name));
}

// Sorted YYYY-MM-DD dates → "Nov 14–15, Dec 6": consecutive days become one range; after three ranges, "and more".
export function formatAppearanceDates(dates: string[], maxRanges = 3) {
  const runs: [string, string][] = [];
  for (const date of [...new Set(dates)].sort()) {
    const run = runs[runs.length - 1];
    if (run && Date.parse(`${date}T00:00:00Z`) - Date.parse(`${run[1]}T00:00:00Z`) === 86_400_000) run[1] = date;
    else runs.push([date, date]);
  }
  const shown = runs.slice(0, maxRanges).map(([start, end]) => formatDateRange(start, end)).join(", ");
  return runs.length > maxRanges ? `${shown} and more` : shown;
}

// Homepage section: hidden with none, a plain row of up to three cards, a carousel from four.
export type CarouselMode = "hidden" | "row" | "carousel";

export function carouselMode(count: number): CarouselMode {
  if (count <= 0) return "hidden";
  return count <= 3 ? "row" : "carousel";
}

// The last index that can sit at the start of the view, so the final page is full rather than half-empty.
export function lastCarouselIndex(count: number, perView: number) {
  return Math.max(0, count - Math.max(1, perView));
}

// Moves the first visible card by delta, clamped to the ends (no wrap-around).
export function stepCarousel(index: number, delta: number, count: number, perView: number) {
  return Math.min(lastCarouselIndex(count, perView), Math.max(0, index + delta));
}

// "1/4": the first visible card's position out of the total.
export function carouselCounter(index: number, count: number) {
  return count ? `${Math.min(count, Math.max(0, index) + 1)}/${count}` : "";
}
