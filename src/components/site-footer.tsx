import Link from "next/link";

const linkFocusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const footerLinkClass = `inline-flex min-h-11 items-center font-bold text-white hover:underline ${linkFocusClass}`;

export default function SiteFooter() {
  return (
    <footer className="bg-forest px-5 py-9 text-white sm:px-10 sm:pt-14 sm:pb-8 lg:px-[72px]">
      <div className="mx-auto max-w-[1296px]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <div>
            <h2 className="font-serif text-[32px] leading-tight font-medium lg:text-[38px]">See a market that should be here?</h2>
            <p className="mt-2 text-[17px] text-sage">Tell us and we’ll add it.</p>
          </div>
          <a
            href="mailto:hello@dropvine.pro?subject=Market%20suggestion"
            className={`inline-flex w-full shrink-0 items-center justify-center rounded-[10px] bg-white px-7 py-4 text-[17px] font-bold text-forest transition-colors hover:bg-cream sm:w-auto ${linkFocusClass}`}
          >
            Suggest a market
          </a>
        </div>
        <div className="mt-10 flex flex-col gap-x-8 gap-y-2 border-t border-forest-line pt-6 text-sm text-sage sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>Dropvine Markets</span>
          <div className="flex flex-wrap items-center gap-x-6">
            <Link href="/about" className={footerLinkClass}>About</Link>
            <a href="https://dropvine.pro" className={footerLinkClass}>For makers</a>
            <span>
              A Dropvine product · Makers selling directly?{" "}
              <a href="https://dropvine.pro" className={footerLinkClass}>See Dropvine Direct</a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
