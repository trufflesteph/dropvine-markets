import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SpotlightCard from "@/components/spotlight-card";
import { defaultShareImage } from "@/lib/image-url";
import { absoluteUrl } from "@/lib/site-url";
import { fetchPublishedSpotlightCards } from "@/lib/spotlights-data";

const description = "Meet the makers behind the booths: short features on the people who sell at local markets.";

export async function generateMetadata(): Promise<Metadata> {
  const [latest] = await fetchPublishedSpotlightCards();
  const images = [latest?.hero_image_url ? { url: latest.hero_image_url, alt: latest.hero_image_alt ?? latest.title } : defaultShareImage];
  return {
    title: "Spotlights | Dropvine Markets",
    description,
    alternates: { canonical: absoluteUrl("/spotlights") },
    openGraph: { title: "Spotlights | Dropvine Markets", description, type: "website", images },
    twitter: { card: "summary_large_image", images },
  };
}

// Exists only while at least one spotlight is published.
export default async function SpotlightsPage() {
  const spotlights = await fetchPublishedSpotlightCards();
  if (!spotlights.length) notFound();

  return (
    <main className="bg-cream px-5 pt-10 pb-14 sm:px-10 sm:pt-14 sm:pb-20 lg:px-[72px]">
      <div className="mx-auto max-w-[1296px]">
        <h1 className="font-serif text-[48px] leading-none font-medium tracking-[-0.018em] text-navy sm:text-[66px]">Spotlights</h1>
        <p className="mt-4 max-w-[560px] text-xl leading-normal text-ink-muted">Meet the makers behind the booths.</p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {spotlights.map((spotlight) => <li key={spotlight.id}><SpotlightCard spotlight={spotlight} headingLevel="h2" /></li>)}
        </ul>
      </div>
    </main>
  );
}
