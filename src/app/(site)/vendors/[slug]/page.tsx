import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { supabasePublicFetch } from "@/lib/supabase-public";
import BackButton from "./back-button";

type Vendor = {
  id: string;
  slug: string;
  business_name: string;
  category: string;
  photo_url: string | null;
  blurb: string | null;
  dropvine_direct_url: string | null;
  external_url: string | null;
};

type Market = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
};

type MarketVendorLink = {
  markets: Market;
};

async function getVendor(slug: string) {
  const response = await supabasePublicFetch(
    `vendors?slug=eq.${encodeURIComponent(slug)}&select=id,slug,business_name,category,photo_url,blurb,dropvine_direct_url,external_url`,
  );

  if (!response.ok) throw new Error("Unable to load vendor");
  const vendors = (await response.json()) as Vendor[];
  return vendors[0] ?? null;
}

async function getVendorMarkets(vendorId: string) {
  const response = await supabasePublicFetch(
    `market_vendor_links?vendor_id=eq.${encodeURIComponent(vendorId)}&select=markets(id,slug,name,city,state)&markets.status=eq.published&order=markets(name).asc`,
  );

  if (!response.ok) throw new Error("Unable to load vendor markets");
  const links = (await response.json()) as MarketVendorLink[];
  return links.map((link) => link.markets).filter(Boolean);
}

export async function generateMetadata({ params }: PageProps<"/vendors/[slug]">): Promise<Metadata> {
  const vendor = await getVendor((await params).slug);
  if (!vendor) return {};

  const description = vendor.blurb ?? `${vendor.business_name} at local markets.`;
  return {
    title: `${vendor.business_name} | Dropvine Markets`,
    description,
    openGraph: {
      title: `${vendor.business_name} | Dropvine Markets`,
      description,
      type: "profile",
      images: vendor.photo_url ? [{ url: vendor.photo_url, alt: vendor.business_name }] : undefined,
    },
  };
}

export default async function VendorPage({ params }: PageProps<"/vendors/[slug]">) {
  const vendor = await getVendor((await params).slug);
  if (!vendor) notFound();
  if (vendor.dropvine_direct_url) redirect(vendor.dropvine_direct_url);

  const markets = await getVendorMarkets(vendor.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-16">
      <article>
        <BackButton />
        <header className="grid gap-8 sm:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] sm:items-end">
          <div className="aspect-square overflow-hidden bg-[#F2F0EA]">
            {vendor.photo_url ? <Image src={vendor.photo_url} alt="" width={640} height={640} sizes="(max-width: 640px) 100vw, 320px" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-8 text-center font-serif text-3xl text-black/30">Dropvine Markets</div>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/45">{vendor.category}</p>
            <h1 className="mt-4 font-serif text-5xl leading-tight sm:text-6xl">{vendor.business_name}</h1>
            {vendor.blurb ? <p className="mt-5 max-w-2xl text-lg leading-relaxed text-black/70">{vendor.blurb}</p> : null}
            {vendor.external_url ? <a className="mt-5 inline-block text-sm underline decoration-black/25 underline-offset-4 hover:decoration-black" href={vendor.external_url}>Visit their website</a> : null}
          </div>
        </header>

        <section aria-labelledby="vendor-markets-heading" className="mt-20 border-t border-black/10 pt-10">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Find them in person</p>
          <h2 id="vendor-markets-heading" className="mt-2 font-serif text-3xl">Markets</h2>
          {markets.length ? (
            <div className="mt-6 grid gap-3">
              {markets.map((market) => (
                <a key={market.id} href={`/markets/${market.slug}`} className="flex items-center justify-between gap-5 rounded-md border border-black/10 bg-white/60 p-5 shadow-sm transition-colors hover:border-black/35 hover:bg-[#F2F0EA]">
                  <div>
                    <h3 className="font-serif text-lg font-medium leading-tight">{market.name}</h3>
                    <p className="mt-1 text-sm text-black/55">{market.city}, {market.state}</p>
                  </div>
                  <span aria-hidden="true" className="text-xl text-black/45">→</span>
                </a>
              ))}
            </div>
          ) : <p className="mt-6 border border-black/10 px-5 py-8 text-sm text-black/55">No published markets listed yet.</p>}
        </section>
      </article>
    </main>
  );
}