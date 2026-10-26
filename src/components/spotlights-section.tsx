"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

import { carouselCounter, carouselMode, lastCarouselIndex, stepCarousel } from "@/lib/spotlights";
import type { SpotlightCard as SpotlightCardData } from "@/lib/spotlights-data";
import SpotlightCard from "./spotlight-card";
import { focusRingClass } from "./styles";

const arrowClass = `inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-white text-xl text-navy transition-colors hover:border-navy disabled:cursor-default disabled:opacity-40 disabled:hover:border-line-strong ${focusRingClass}`;

// Cards per view by width: 1 on phones, 2 on tablets, 3 from lg. Matches the basis classes on each slide.
function cardsPerView() {
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  return window.matchMedia("(min-width: 640px)").matches ? 2 : 1;
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

// Homepage "Spotlights" band. Nothing with no spotlights; a plain row for 1–3; from 4, a carousel that scrolls
// natively (so swipe works on touch), with labelled previous/next buttons and a counter. No autoplay.
export default function SpotlightsSection({ spotlights }: { spotlights: SpotlightCardData[] }) {
  const mode = carouselMode(spotlights.length);
  const trackRef = useRef<HTMLUListElement>(null);
  const [scrolledIndex, setScrolledIndex] = useState(0);
  const perView = useSyncExternalStore(subscribeToResize, cardsPerView, () => 3);
  const last = lastCarouselIndex(spotlights.length, perView);
  const index = Math.min(scrolledIndex, last);

  // The card at the left edge, from the scroll position, so swiping and tabbing keep the counter right.
  function syncIndex() {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const step = first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
    setScrolledIndex(Math.round(track.scrollLeft / step));
  }

  function go(delta: number) {
    const track = trackRef.current;
    const next = stepCarousel(index, delta, spotlights.length, perView);
    const target = track?.children[next] as HTMLElement | undefined;
    if (!track || !target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
    setScrolledIndex(next);
  }

  if (mode === "hidden") return null;

  return (
    <section aria-labelledby="spotlights-heading" className="border-t border-line bg-paper px-5 py-10 sm:px-10 sm:py-[72px] lg:px-[72px]">
      <div className="mx-auto max-w-[1296px]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h2 id="spotlights-heading" className="font-serif text-4xl leading-tight font-medium text-navy sm:text-5xl">Spotlights</h2>
            <p className="mt-2 text-lg text-ink-muted">Meet the makers behind the booths.</p>
          </div>
          {mode === "carousel" ? (
            <div className="flex items-center gap-3">
              <p className="min-w-[3ch] text-[15px] font-medium text-ink-muted tabular-nums" aria-live="polite">
                <span className="sr-only">Showing spotlight </span>{carouselCounter(index, spotlights.length)}
              </p>
              <button type="button" className={arrowClass} aria-label="Previous spotlights" aria-controls="spotlights-track" disabled={index <= 0} onClick={() => go(-1)}><span aria-hidden="true">←</span></button>
              <button type="button" className={arrowClass} aria-label="Next spotlights" aria-controls="spotlights-track" disabled={index >= last} onClick={() => go(1)}><span aria-hidden="true">→</span></button>
            </div>
          ) : null}
        </div>

        {mode === "row" ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {spotlights.map((spotlight) => <li key={spotlight.id}><SpotlightCard spotlight={spotlight} /></li>)}
          </ul>
        ) : (
          <>
            <ul
              id="spotlights-track"
              ref={trackRef}
              aria-roledescription="carousel"
              aria-label="Spotlights"
              onScroll={syncIndex}
              className="mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-8 [&::-webkit-scrollbar]:hidden"
            >
              {spotlights.map((spotlight, position) => (
                <li
                  key={spotlight.id}
                  aria-roledescription="slide"
                  aria-label={`${position + 1} of ${spotlights.length}`}
                  className="shrink-0 basis-full snap-start sm:basis-[calc((100%-2rem)/2)] lg:basis-[calc((100%-4rem)/3)]"
                >
                  <SpotlightCard spotlight={spotlight} />
                </li>
              ))}
            </ul>
            <Link href="/spotlights" className={`mt-6 inline-flex min-h-11 items-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
              See all spotlights <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
