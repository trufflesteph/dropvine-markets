import Image from "next/image";

import { categoryGroupFor, categoryPinColors } from "@/lib/category-groups";
import type { SpotlightCard as SpotlightCardData } from "@/lib/spotlights-data";
import StallPlaceholder from "./stall-placeholder";
import { focusRingClass } from "./styles";

// Category label on its group color, with white or navy text, whichever reaches 4.5:1.
export function CategoryChip({ category }: { category: string }) {
  return <span className="inline-flex rounded-full px-3 py-1 text-xs leading-tight font-bold tracking-[0.6px] uppercase" style={categoryPinColors(category)}>{category}</span>;
}

// Used by the homepage section and the /spotlights index. The left edge carries the category color.
export default function SpotlightCard({ spotlight, headingLevel = "h3" }: { spotlight: SpotlightCardData; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const edge = spotlight.maker_category ? categoryGroupFor(spotlight.maker_category).color : "#EADFCC";
  return (
    <a
      href={`/spotlights/${spotlight.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-[20px] border border-l-[6px] border-line bg-white transition-[border-color,box-shadow] hover:shadow-[0_10px_30px_-12px_rgba(29,52,97,0.18)] ${focusRingClass}`}
      style={{ borderLeftColor: edge }}
    >
      <div className="relative aspect-[4/3] bg-sky">
        {spotlight.hero_image_url ? (
          <Image src={spotlight.hero_image_url} alt={spotlight.hero_image_alt ?? ""} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <StallPlaceholder className="w-[130px] sm:w-[150px]" />
        )}
      </div>
      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] font-bold tracking-[1.8px] text-clay uppercase">{spotlight.maker_name}</p>
          {spotlight.maker_category ? <CategoryChip category={spotlight.maker_category} /> : null}
        </div>
        <Heading className="mt-2 font-serif text-[25px] leading-[1.1] font-semibold text-navy sm:text-[28px]">{spotlight.title}</Heading>
        {spotlight.summary ? <p className="mt-2 line-clamp-2 text-[15px] text-ink-muted">{spotlight.summary}</p> : null}
        <span className="mt-auto pt-4 text-base font-bold text-clay group-hover:text-clay-dark">Read spotlight <span aria-hidden="true">→</span></span>
      </div>
    </a>
  );
}
