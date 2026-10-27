import Link from "next/link";

import SpotlightCard from "@/components/spotlight-card";
import { focusRingClass } from "@/components/styles";
import type { SpotlightCard as SpotlightCardData } from "@/lib/spotlights-data";
import { marketSpotlightDisplay } from "@/lib/spotlights";

// "Spotlights from this market": renders nothing at all when none of this market's vendors has one.
export default function MarketSpotlights({ spotlights }: { spotlights: SpotlightCardData[] }) {
  const { visible, shown, seeAll } = marketSpotlightDisplay(spotlights);
  if (!visible) return null;

  return (
    <section aria-labelledby="market-spotlights-heading" className="mt-20 border-t border-black/10 pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/60">Meet the makers</p>
          <h2 id="market-spotlights-heading" className="mt-2 font-serif text-3xl">Spotlights from this market</h2>
        </div>
        {seeAll ? (
          <Link href="/spotlights" className={`inline-flex min-h-11 items-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
            See all spotlights <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        ) : null}
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
        {shown.map((spotlight) => <li key={spotlight.id}><SpotlightCard spotlight={spotlight} /></li>)}
      </ul>
    </section>
  );
}
