"use client";

import { useState } from "react";

import { focusRingClass } from "@/components/styles";

type Props = { embedUrl: string; provider: "YouTube" | "Vimeo"; title: string };

// Click to load: nothing is requested from YouTube or Vimeo until the visitor presses play, and the embed then
// uses youtube-nocookie.com or Vimeo's dnt=1. No third-party scripts on the page itself.
export default function SpotlightVideo({ embedUrl, provider, title }: Props) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[20px] bg-navy">
      {playing ? (
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-white ${focusRingClass} focus-visible:outline-offset-[-4px] focus-visible:outline-white`}
        >
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-white text-2xl text-navy">▶</span>
          <span className="text-lg font-bold">Play video</span>
          <span className="text-sm text-sky">Loads from {provider}</span>
        </button>
      )}
    </div>
  );
}
