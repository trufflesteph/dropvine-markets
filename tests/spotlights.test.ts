import assert from "node:assert/strict";
import { test } from "node:test";

import {
  carouselCounter, carouselMode, classifyVideoUrl, formatAppearanceDates, isValidSlug, lastCarouselIndex, marketSpotlightDisplay,
  marketSpotlights, parseBody, slugify, spotlightSlugByVendor, stepCarousel, upcomingAppearances,
} from "../src/lib/spotlights.ts";

test("slugs come from the title: lowercase, hyphenated, accents folded, & spelled out", () => {
  assert.equal(slugify("Meet Clay & Co."), "meet-clay-and-co");
  assert.equal(slugify("  Café Ceramics: Mugs, Bowls!  "), "cafe-ceramics-mugs-bowls");
  assert.equal(slugify("Rosie’s Jam Kitchen"), "rosies-jam-kitchen");
  assert.equal(slugify("---"), "");
  assert.equal(slugify("a".repeat(90)).length, 80);
  assert.ok(!slugify(`${"word ".repeat(15)}end`).endsWith("-"), "truncation never leaves a trailing hyphen");
});

test("only url-safe slugs are valid", () => {
  for (const slug of ["clay-co", "a", "studio-2026"]) assert.ok(isValidSlug(slug), slug);
  for (const slug of ["", "Clay", "clay--co", "-clay", "clay-", "clay co", "café", "a".repeat(81)]) assert.ok(!isValidSlug(slug), slug);
  assert.ok(isValidSlug(slugify("Anything at All: 100% Handmade")));
});

test("body text splits into paragraphs on blank lines and subheadings on '## '", () => {
  const body = "First paragraph\ncontinues here.\n\n\n## How it started\nSecond paragraph.\n\n   \nThird.\r\n\r\n## \n##Not a heading";
  assert.deepEqual(parseBody(body), [
    { type: "paragraph", text: "First paragraph\ncontinues here." },
    { type: "heading", text: "How it started" },
    { type: "paragraph", text: "Second paragraph." },
    { type: "paragraph", text: "Third." },
    { type: "paragraph", text: "##Not a heading" },
  ]);
  assert.deepEqual(parseBody(""), []);
  assert.deepEqual(parseBody(null), []);
});

test("body text is never interpreted: HTML and links stay as plain text", () => {
  const blocks = parseBody("<script>alert(1)</script>\n\nSee https://example.com and <b>bold</b>");
  assert.deepEqual(blocks.map((block) => block.text), ["<script>alert(1)</script>", "See https://example.com and <b>bold</b>"]);
  assert.ok(blocks.every((block) => block.type === "paragraph"));
});

test("YouTube URLs become youtube-nocookie embeds", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ]) {
    const video = classifyVideoUrl(url);
    assert.equal(video?.kind, "youtube", url);
    assert.ok(video?.kind === "youtube" && video.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), url);
  }
  assert.equal(classifyVideoUrl("https://www.youtube.com/watch?v=short")?.kind, "link", "an invalid id is not embedded");
  assert.equal(classifyVideoUrl("https://www.youtube.com/@somechannel")?.kind, "link");
});

test("Vimeo URLs become do-not-track embeds, keeping an unlisted video's hash", () => {
  const video = classifyVideoUrl("https://vimeo.com/76979871");
  assert.equal(video?.kind, "vimeo");
  assert.ok(video?.kind === "vimeo" && video.embedUrl.startsWith("https://player.vimeo.com/video/76979871?") && video.embedUrl.includes("dnt=1"));
  const unlisted = classifyVideoUrl("https://vimeo.com/76979871/abc123def");
  assert.ok(unlisted?.kind === "vimeo" && unlisted.embedUrl.includes("h=abc123def"));
  const player = classifyVideoUrl("https://player.vimeo.com/video/76979871?h=ff00");
  assert.ok(player?.kind === "vimeo" && player.id === "76979871" && player.embedUrl.includes("h=ff00"));
  assert.equal(classifyVideoUrl("https://vimeo.com/channels/staffpicks/76979871")?.kind, "vimeo");
});

test("other video hosts become a link with a readable site name", () => {
  assert.deepEqual(classifyVideoUrl("https://www.instagram.com/reel/Cx1/"), { kind: "link", site: "Instagram", url: "https://www.instagram.com/reel/Cx1/" });
  const linkedIn = classifyVideoUrl("https://www.linkedin.com/posts/abc");
  assert.ok(linkedIn?.kind === "link" && linkedIn.site === "LinkedIn");
  const tiktok = classifyVideoUrl("https://www.tiktok.com/@maker/video/1");
  assert.ok(tiktok?.kind === "link" && tiktok.site === "TikTok");
  const other = classifyVideoUrl("https://videos.example.org/watch/1");
  assert.ok(other?.kind === "link" && other.site === "videos.example.org");
});

test("blank, malformed and non-http video URLs are ignored", () => {
  for (const value of [null, undefined, "", "   ", "not a url", "javascript:alert(1)", "ftp://example.com/video"]) {
    assert.equal(classifyVideoUrl(value), null, String(value));
  }
});

test("homepage section: hidden with none, a row for 1 to 3, a carousel from 4", () => {
  assert.equal(carouselMode(0), "hidden");
  assert.equal(carouselMode(1), "row");
  assert.equal(carouselMode(3), "row");
  assert.equal(carouselMode(4), "carousel");
  assert.equal(carouselMode(12), "carousel");
});

test("carousel steps one card at a time and stops at the ends", () => {
  // 4 cards, 3 visible: the view can start at card 1 or card 2.
  assert.equal(lastCarouselIndex(4, 3), 1);
  assert.equal(stepCarousel(0, 1, 4, 3), 1);
  assert.equal(stepCarousel(1, 1, 4, 3), 1, "no wrap past the end");
  assert.equal(stepCarousel(0, -1, 4, 3), 0, "no wrap before the start");
  // 1 visible on mobile: every card can lead.
  assert.equal(lastCarouselIndex(4, 1), 3);
  assert.equal(stepCarousel(2, 1, 4, 1), 3);
  assert.equal(lastCarouselIndex(2, 3), 0);
});

test("the counter shows the first visible card out of the total", () => {
  assert.equal(carouselCounter(0, 4), "1/4");
  assert.equal(carouselCounter(3, 4), "4/4");
  assert.equal(carouselCounter(9, 4), "4/4");
  assert.equal(carouselCounter(0, 0), "");
});

test("'Find them at' lists only markets with upcoming, uncanceled dates, soonest first", () => {
  const today = "2026-11-01";
  const appearances = upcomingAppearances([
    { booth_label: ["14", "12"], markets: { slug: "holiday", name: "Holiday Bazaar", market_dates: [{ date: "2026-12-05", is_canceled: false }, { date: "2026-12-06", is_canceled: false }] } },
    { booth_label: "3", markets: { slug: "past", name: "Summer Fair", market_dates: [{ date: "2026-07-01", is_canceled: false }] } },
    { booth_label: null, markets: { slug: "canceled", name: "Canceled Market", market_dates: [{ date: "2026-11-20", is_canceled: true }] } },
    { booth_label: "A1", markets: null },
    { booth_label: null, markets: { slug: "soon", name: "Night Market", market_dates: [{ date: "2026-10-01", is_canceled: false }, { date: "2026-11-01", is_canceled: false }] } },
    { booth_label: null, markets: { slug: "no-dates", name: "No Dates", market_dates: null } },
  ], today);
  assert.deepEqual(appearances.map((appearance) => appearance.slug), ["soon", "holiday"]);
  assert.deepEqual(appearances[0].dates, ["2026-11-01"], "past dates are dropped, today counts");
  assert.deepEqual(appearances[1].booths, ["14", "12"]);
});

const card = (id: string, vendor_id: string | null) => ({ id, slug: `spotlight-${id}`, vendor_id });

test("a market shows only spotlights whose vendor is linked to it, in the order given, once each", () => {
  const spotlights = [card("1", "v-here"), card("2", "v-elsewhere"), card("3", null), card("4", "v-also-here"), card("1", "v-here"), card("5", "v-here")];
  assert.deepEqual(marketSpotlights(spotlights, ["v-here", "v-also-here"]).map((spotlight) => spotlight.id), ["1", "4", "5"]);
  assert.deepEqual(marketSpotlights(spotlights, []), [], "a market with no linked vendors shows none");
  assert.deepEqual(marketSpotlights(spotlights, new Set(["v-nobody"])), []);
});

test("market spotlights: none hides the section, 1 to 3 show all, 4 or more show 3 plus See all", () => {
  assert.deepEqual(marketSpotlightDisplay([]), { visible: false, shown: [], seeAll: false });
  for (const count of [1, 2, 3]) {
    const list = Array.from({ length: count }, (_, index) => card(String(index), "v"));
    assert.deepEqual(marketSpotlightDisplay(list), { visible: true, shown: list, seeAll: false }, `${count}`);
  }
  const many = Array.from({ length: 5 }, (_, index) => card(String(index), "v"));
  const display = marketSpotlightDisplay(many);
  assert.deepEqual(display.shown.map((spotlight) => spotlight.id), ["0", "1", "2"]);
  assert.equal(display.seeAll, true);
  assert.equal(marketSpotlightDisplay(many.slice(0, 4)).seeAll, true);
});

test("each vendor's badge links to their first spotlight", () => {
  assert.deepEqual(spotlightSlugByVendor([card("1", "v1"), card("2", "v1"), card("3", "v2"), card("4", null)]), { v1: "spotlight-1", v2: "spotlight-3" });
});

test("appearance dates group consecutive days into ranges", () => {
  assert.equal(formatAppearanceDates(["2026-12-05"]), "Dec 5");
  assert.equal(formatAppearanceDates(["2026-12-06", "2026-12-05"]), "Dec 5–6");
  assert.equal(formatAppearanceDates(["2026-11-30", "2026-12-01", "2026-12-13"]), "Nov 30–Dec 1, Dec 13");
  assert.equal(formatAppearanceDates(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]), "Nov 1, Nov 8, Nov 15 and more");
});
