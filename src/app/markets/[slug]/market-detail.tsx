"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export type MarketVendor = {
  id: string;
  map_x: number | null;
  map_y: number | null;
  booth_label: string | null;
  vendor: {
    id: string;
    slug: string;
    business_name: string;
    category: string;
    photo_url: string | null;
    dropvine_direct_url: string | null;
  };
};

type MarketDetailProps = {
  mapImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  vendors: MarketVendor[];
};

function vendorHref(vendor: MarketVendor["vendor"]) {
  return vendor.dropvine_direct_url ?? `/vendors/${vendor.slug}`;
}

const categoryColors: Record<string, { background: string; foreground: string }> = {
  bakery: { background: "#F2C14E", foreground: "#241B00" },
  beverage: { background: "#7BC8A4", foreground: "#092A1A" },
  food: { background: "#E8875A", foreground: "#321207" },
  produce: { background: "#8FBE5D", foreground: "#122007" },
  artisan: { background: "#B79AD8", foreground: "#21102F" },
  crafts: { background: "#B79AD8", foreground: "#21102F" },
  vintage: { background: "#D99A9A", foreground: "#321313" },
  wellness: { background: "#78B7C9", foreground: "#08222B" },
};

function categoryColor(category: string) {
  const normalized = category.toLowerCase();
  const match = Object.entries(categoryColors).find(([name]) => normalized.includes(name));
  return match?.[1] ?? { background: "#D5D0C5", foreground: "#211F1A" };
}

export default function MarketDetail({ mapImageUrl, latitude, longitude, vendors }: MarketDetailProps) {
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const vendorRefs = useRef<Record<string, HTMLElement | null>>({});

  function selectVendor(vendorId: string, shouldScroll = false) {
    setActiveVendorId(vendorId);

    if (shouldScroll) {
      document.getElementById("market-vendors")?.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => vendorRefs.current[vendorId]?.focus());
    }
  }

  const hasCoordinates = latitude !== null && longitude !== null;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude! - 0.02}%2C${latitude! - 0.015}%2C${longitude! + 0.02}%2C${latitude! + 0.015}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;

  return (
    <>
      <section aria-labelledby="market-map-heading" className="mt-20 border-t border-black/10 pt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Layout</p>
            <h2 id="market-map-heading" className="mt-2 font-serif text-3xl">Explore the Market</h2>
          </div>
          {mapImageUrl ? <p className="text-right text-sm text-black/50">Select a booth to find it below.</p> : null}
        </div>

        {mapImageUrl ? (
          <div className="market-map-surface relative w-full max-w-full overflow-hidden border border-black/10 bg-[#F2F0EA]">
            <Image src={mapImageUrl} alt="Market vendor map" width={1600} height={900} sizes="(max-width: 1280px) 100vw, 1152px" unoptimized className="block h-auto w-full max-w-full" />
            {vendors.map((link, index) => link.map_x !== null && link.map_y !== null ? (
              <button
                key={link.id}
                type="button"
                aria-label={`Find vendor ${index + 1}, ${link.vendor.business_name}, ${link.vendor.category}`}
                aria-pressed={activeVendorId === link.vendor.id}
                className={`group absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-xs font-bold shadow-none transition-all sm:h-7 sm:w-7 ${activeVendorId === link.vendor.id ? "z-10 sm:h-9 sm:w-9" : "hover:z-10"}`}
                style={{ left: `${link.map_x}%`, top: `${link.map_y}%` }}
                onClick={() => selectVendor(link.vendor.id, true)}
              >
                <span className={`flex items-center justify-center border-2 border-white text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all ${activeVendorId === link.vendor.id ? "h-9 w-9 ring-4 ring-black/20" : "h-7 w-7 group-hover:h-8 group-hover:w-8"}`} style={{ backgroundColor: categoryColor(link.vendor.category).background, color: categoryColor(link.vendor.category).foreground }}>
                  {index + 1}
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0E0E0C] px-2 py-1 font-sans text-xs font-normal text-[#FAFAF7] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {link.vendor.business_name}
                </span>
              </button>
            ) : null)}
          </div>
        ) : mapUrl ? (
          <div className="overflow-hidden border border-black/10 bg-[#F2F0EA]">
            <iframe
              title="Market location map"
              src={mapUrl}
              className="h-[360px] w-full border-0 sm:h-[440px]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="border border-black/10 bg-[#F2F0EA] px-6 py-16 text-center text-sm text-black/55">
            Location map unavailable.
          </div>
        )}
      </section>

      <section id="market-vendors" aria-labelledby="market-vendors-heading" className="mt-20 scroll-mt-8 border-t border-black/10 pt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Meet the</p>
            <h2 id="market-vendors-heading" className="mt-2 font-serif text-3xl">Vendors</h2>
          </div>
          <p className="text-sm text-black/50">{vendors.length} {vendors.length === 1 ? "vendor" : "vendors"}</p>
        </div>

        {vendors.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {vendors.map((link, index) => {
              const color = categoryColor(link.vendor.category);
              return (
              <article
                key={link.id}
                ref={(element) => { vendorRefs.current[link.vendor.id] = element; }}
                tabIndex={-1}
                className={`border-l-4 transition-colors focus:outline-none ${activeVendorId === link.vendor.id ? "bg-[#F2F0EA]" : ""}`}
                style={{ borderLeftColor: color.background }}
              >
                <a
                  href={vendorHref(link.vendor)}
                  target={link.vendor.dropvine_direct_url ? "_blank" : undefined}
                  rel={link.vendor.dropvine_direct_url ? "noopener noreferrer" : undefined}
                  onClick={() => selectVendor(link.vendor.id)}
                  className="flex min-h-28 items-center gap-4 border border-black/10 p-3 transition-colors hover:border-black/35"
                >
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-[#F2F0EA]">
                    {link.vendor.photo_url ? <Image src={link.vendor.photo_url} alt="" fill sizes="96px" className="object-cover" /> : null}
                    {!link.vendor.photo_url ? <span className="flex h-full items-center justify-center px-2 text-center font-serif text-sm text-black/35">Dropvine</span> : null}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <h3 className="font-serif text-xl leading-tight">{link.vendor.business_name}</h3>
                    <p className="mt-1 text-sm text-black/55">{link.vendor.category}</p>
                  </div>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold" style={{ backgroundColor: color.background, color: color.foreground }}>{index + 1}</span>
                </a>
              </article>
              );
            })}
          </div>
        ) : (
          <p className="border border-black/10 px-5 py-10 text-center text-sm text-black/55">No vendors listed yet.</p>
        )}
      </section>
    </>
  );
}