// Shown wherever a market has no photo. Fills its (positioned) parent with a sky tile.
export default function StallPlaceholder({ className = "w-40", tileClassName = "" }: { className?: string; tileClassName?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-sky ${tileClassName}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className={`h-auto max-h-full ${className}`}>
        <rect x="50" y="82" width="100" height="56" rx="3" fill="#FFFFFF" />
        <image href="/brand/dropvine-sprout.png" x="74" y="88" width="52" height="45" />
        <path d="M40 30H160L172 70H28Z" fill="#2F5128" />
        <path d="M28 70a12 12 0 0 0 24 0a12 12 0 0 0 24 0a12 12 0 0 0 24 0a12 12 0 0 0 24 0a12 12 0 0 0 24 0a12 12 0 0 0 24 0z" fill="#2F5128" />
        <path d="M60 30L52 70M80 30L76 70M100 30V70M120 30L124 70M140 30L148 70" stroke="#BFD9F2" strokeWidth="3" fill="none" />
        <rect x="44" y="82" width="6" height="92" fill="#2F5128" />
        <rect x="150" y="82" width="6" height="92" fill="#2F5128" />
        <rect x="34" y="138" width="132" height="8" rx="2" fill="#2F5128" />
        <rect x="20" y="174" width="160" height="4" rx="2" fill="#2F5128" opacity="0.3" />
      </svg>
    </div>
  );
}
