import Image from "next/image";
import Link from "next/link";

import SiteNav from "./site-nav";
import { focusRingClass } from "./styles";

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper px-5 py-3 sm:px-10 sm:py-3.5 lg:px-[72px]">
      <div className="mx-auto flex max-w-[1296px] flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link href="/" className={`flex min-h-11 items-center text-navy no-underline ${focusRingClass}`}>
          <Image
            src="/brand/dropvine-wordmark.png"
            alt="Dropvine Markets"
            width={138}
            height={48}
            preload
            className="h-[38px] w-auto lg:h-12"
          />
        </Link>
        <div className="flex items-center gap-8">
          <SiteNav />
          {/* Opens the alerts dialog (src/components/alerts-dialog.tsx). */}
          <button
            type="button"
            data-alerts-open
            className={`inline-flex min-h-11 items-center rounded-[10px] bg-navy px-4 text-[15px] font-bold text-white transition-colors hover:bg-navy-dark ${focusRingClass}`}
          >
            <span className="lg:hidden">Get alerts</span>
            <span className="hidden lg:inline">Get market alerts</span>
          </button>
        </div>
      </div>
    </header>
  );
}
