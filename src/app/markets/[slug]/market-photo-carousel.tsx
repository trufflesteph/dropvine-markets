"use client";

import { useState } from "react";

type MarketPhoto = { id: string; photo_url: string };

export default function MarketPhotoCarousel({ photos, marketName }: { photos: MarketPhoto[]; marketName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (!photos.length) return <div className="mt-10 flex aspect-[16/8] items-center justify-center bg-[#F2F0EA] font-serif text-3xl text-black/30 sm:mt-14">Dropvine Markets</div>;

  const activePhoto = photos[activeIndex];
  function step(direction: number) {
    setActiveIndex((current) => (current + direction + photos.length) % photos.length);
  }

  return <section aria-label={`${marketName} photos`} className="mt-10 sm:mt-14">
    <div className="relative aspect-[16/8] overflow-hidden bg-[#F2F0EA]"><img src={activePhoto.photo_url} alt={`${marketName} photo ${activeIndex + 1} of ${photos.length}`} className="h-full w-full object-cover" />{photos.length > 1 ? <><button aria-label="Previous photo" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/60 bg-black/60 text-xl text-white" onClick={() => step(-1)} type="button">&#8592;</button><button aria-label="Next photo" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/60 bg-black/60 text-xl text-white" onClick={() => step(1)} type="button">&#8594;</button></> : null}</div>
    {photos.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto">{photos.map((photo, index) => <button aria-label={`Show photo ${index + 1}`} aria-pressed={index === activeIndex} className={`h-16 w-20 shrink-0 overflow-hidden border-2 ${index === activeIndex ? "border-black" : "border-transparent"}`} key={photo.id} onClick={() => setActiveIndex(index)} type="button"><img src={photo.photo_url} alt="" className="h-full w-full object-cover" /></button>)}</div> : null}
  </section>;
}
