import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { primaryButtonClass } from "@/components/styles";

export const metadata: Metadata = {
  title: "About | Dropvine Markets",
  description: "Dropvine Markets brings local markets and the makers who sell there into one place, so you can find them and shop small.",
};

export default function AboutPage() {
  return (
    <main className="bg-cream">
      <section className="px-5 pt-8 pb-6 sm:px-10 sm:pt-[72px] sm:pb-10 lg:px-[72px]">
        <h1 className="mx-auto max-w-[1296px] font-serif text-[54px] leading-[0.98] font-medium tracking-[-1px] text-navy sm:text-[88px] sm:tracking-[-1.8px]">
          Shop small. <span className="text-forest">Build community.</span>
        </h1>
      </section>

      <section className="px-5 pb-14 sm:px-10 sm:pb-20 lg:px-[72px] lg:pb-24">
        <div className="mx-auto grid max-w-[1296px] gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative h-[340px] overflow-hidden rounded-3xl bg-sky sm:h-[480px] lg:h-[620px]">
            <Image
              src="/brand/stephanie-founder.jpg"
              alt="Stephanie, founder of Dropvine, smiling over a cup of coffee"
              fill
              preload
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[50%_38%]"
            />
          </div>

          <div className="max-w-[640px] text-[17px] leading-[1.6] text-navy lg:text-xl">
            <div className="space-y-[22px]">
              <p>I believe small businesses are the fabric of every community. The more we support them, the more vibrant, engaged, and connected a place becomes.</p>
              <p>I especially want to support small artisan businesses, because they’re run by people following their passion. But passion doesn’t come with a marketing budget, and many of these makers struggle to be seen.</p>
              <p>
                That’s where Dropvine started.{" "}
                <a href="https://dropvine.pro" className="font-bold text-clay hover:text-clay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">Dropvine Direct</a>{" "}
                gives makers a simple way to sell their work directly to their customers. Dropvine Markets is the next step, for the places where makers meet their neighbors in person.
              </p>
              <p>Markets are temporary by nature. The vendors change from one date to the next, and most markets don’t have an advertising budget. Dropvine Markets puts them in one place: when they’re happening, who’s there, and what they sell. Pick a market and go meet the makers.</p>
            </div>
            <Link href="/#markets" className={`mt-9 ${primaryButtonClass}`}>Find a market</Link>
            <div className="mt-10">
              <p className="font-serif text-2xl font-semibold">Stephanie</p>
              <p className="mt-1 text-[15px] text-ink-muted">Founder of Dropvine</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
