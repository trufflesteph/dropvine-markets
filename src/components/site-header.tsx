import Image from "next/image";
import Link from "next/link";

import SiteNav from "./site-nav";
import { focusRingClass } from "./styles";

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper px-5 py-3 sm:px-10 sm:py-3.5 lg:px-[72px]">
      <div className="mx-auto flex max-w-[1296px] items-center justify-between gap-6">
        <Link href="/" className={`flex min-h-11 items-end gap-2 text-navy no-underline ${focusRingClass}`}>
          <Image
            src="/brand/dropvine-wordmark.png"
            alt="Dropvine"
            width={138}
            height={48}
            preload
            className="h-[38px] w-auto lg:h-12"
          />
          <span className="mb-[3px] font-serif text-2xl leading-none font-semibold lg:text-[30px]">Markets</span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
