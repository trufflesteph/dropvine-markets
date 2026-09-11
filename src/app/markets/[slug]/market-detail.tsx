"use client";

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
            <h2 id="market-map-heading" className="mt-2 font-serif text-3xl">Find the vendors</h2>
          </div>
          {mapImageUrl ? <p className="text-right text-sm text-black/50">Select a booth to find it below.</p> : null}
        </div>

        {mapImageUrl ? (
          <div className="relative overflow-hidden border border-black/10 bg-[#F2F0EA]">
            <img src={mapImageUrl} alt="Market vendor map" className="block h-auto w-full" />
            {vendors.map((link) => link.map_x !== null && link.map_y !== null ? (
              <button
                key={link.id}
                type="button"
                aria-label={`Find ${link.vendor.business_name}`}
                aria-pressed={activeVendorId === link.vendor.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 border-2 border-white bg-black shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all ${activeVendorId === link.vendor.id ? "z-10 h-8 w-8 bg-[#B84A32] ring-4 ring-[#B84A32]/25" : "h-6 w-6 hover:h-7 hover:w-7"}`}
                style={{ left: `${link.map_x}%`, top: `${link.map_y}%` }}
                onClick={() => selectVendor(link.vendor.id, true)}
              >
                <span className="sr-only">{link.vendor.business_name}</span>
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
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">On the map</p>
            <h2 id="market-vendors-heading" className="mt-2 font-serif text-3xl">Vendors</h2>
          </div>
          <p className="text-sm text-black/50">{vendors.length} {vendors.length === 1 ? "vendor" : "vendors"}</p>
        </div>

        {vendors.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {vendors.map((link) => (
              <article
                key={link.id}
                ref={(element) => { vendorRefs.current[link.vendor.id] = element; }}
                tabIndex={-1}
                className={`transition-colors focus:outline-none ${activeVendorId === link.vendor.id ? "bg-[#F2F0EA]" : ""}`}
              >
                <a
                  href={vendorHref(link.vendor)}
                  onClick={() => selectVendor(link.vendor.id)}
                  className="flex min-h-28 gap-4 border border-black/10 p-3 transition-colors hover:border-black/35"
                >
                  <div className="h-24 w-24 shrink-0 bg-[#F2F0EA] bg-cover bg-center" style={link.vendor.photo_url ? { backgroundImage: `url(${link.vendor.photo_url})` } : undefined}>
                    {!link.vendor.photo_url ? <span className="flex h-full items-center justify-center px-2 text-center font-serif text-sm text-black/35">Dropvine</span> : null}
                  </div>
                  <div className="min-w-0 py-1">
                    <h3 className="font-serif text-xl leading-tight">{link.vendor.business_name}</h3>
                    <p className="mt-1 text-sm text-black/55">{link.vendor.category}</p>
                    {link.booth_label ? <p className="mt-3 text-xs uppercase tracking-[0.14em] text-black/45">{link.booth_label}</p> : null}
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="border border-black/10 px-5 py-10 text-center text-sm text-black/55">No vendors listed yet.</p>
        )}
      </section>
    </>
  );
}