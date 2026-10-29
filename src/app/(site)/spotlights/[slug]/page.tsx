import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryChip } from "@/components/spotlight-card";
import { focusRingClass, primaryButtonClass } from "@/components/styles";
import { hasAdminSession } from "@/lib/admin-auth";
import { formatBooths } from "@/lib/booths";
import { defaultShareImage } from "@/lib/image-url";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import { getSpotlight, getSpotlightVendor, getVendorAppearances, type Spotlight } from "@/lib/spotlights-data";
import { classifyVideoUrl, formatAppearanceDates, parseBody } from "@/lib/spotlights";
import SpotlightVideo from "./spotlight-video";

// Drafts render only for a signed-in admin (as a noindex preview); everyone else gets a 404.
async function loadSpotlight(slug: string) {
  const spotlight = await getSpotlight(slug, await hasAdminSession());
  return spotlight ? { spotlight, preview: spotlight.status !== "published" } : null;
}

function description(spotlight: Spotlight) {
  return spotlight.summary || `A Dropvine Markets spotlight on ${spotlight.maker_name}.`;
}

export async function generateMetadata({ params }: PageProps<"/spotlights/[slug]">): Promise<Metadata> {
  const loaded = await loadSpotlight((await params).slug);
  if (!loaded) return {};
  const { spotlight, preview } = loaded;

  const title = `${spotlight.title} | Dropvine Markets`;
  const images = [spotlight.hero_image_url ? { url: spotlight.hero_image_url, alt: spotlight.hero_image_alt ?? spotlight.title } : defaultShareImage];
  return {
    title,
    description: description(spotlight),
    alternates: { canonical: absoluteUrl(`/spotlights/${encodeURIComponent(spotlight.slug)}`) },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description: description(spotlight),
      type: "article",
      ...(spotlight.published_at ? { publishedTime: spotlight.published_at } : {}),
      modifiedTime: spotlight.updated_at,
      images,
    },
    twitter: { card: "summary_large_image", title, description: description(spotlight), images },
  };
}

function articleJsonLd(spotlight: Spotlight) {
  const url = absoluteUrl(`/spotlights/${encodeURIComponent(spotlight.slug)}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: spotlight.title,
    description: description(spotlight),
    ...(spotlight.hero_image_url ? { image: [spotlight.hero_image_url] } : {}),
    datePublished: spotlight.published_at ?? spotlight.created_at,
    dateModified: spotlight.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "Dropvine Markets", url: siteUrl },
    publisher: { "@type": "Organization", name: "Dropvine Markets", url: siteUrl, logo: { "@type": "ImageObject", url: absoluteUrl("/brand/dropvine-wordmark.png") } },
  };
}

const sidebarHeadingClass = "text-[13px] font-bold tracking-[1.8px] text-navy uppercase";
const sidebarCardClass = "rounded-[20px] border border-line bg-white p-6";
const directButtonClass = `inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-navy px-5 py-3.5 text-center text-base leading-tight font-bold text-white transition-colors hover:bg-navy-dark ${focusRingClass}`;

export default async function SpotlightPage({ params }: PageProps<"/spotlights/[slug]">) {
  const loaded = await loadSpotlight((await params).slug);
  if (!loaded) notFound();
  const { spotlight, preview } = loaded;

  const [vendor, appearances] = spotlight.vendor_id
    ? await Promise.all([getSpotlightVendor(spotlight.vendor_id), getVendorAppearances(spotlight.vendor_id)])
    : [null, []];
  const blocks = parseBody(spotlight.body);
  const video = classifyVideoUrl(spotlight.video_url);
  const links = spotlight.links ?? [];
  const photos = spotlight.photos ?? [];
  const hasSidebar = appearances.length > 0 || Boolean(vendor?.dropvine_direct_url) || links.length > 0;

  return (
    <main className="bg-cream">
      {preview ? (
        <p className="bg-clay-dark px-5 py-3 text-center text-sm font-bold text-white" role="status">
          Draft preview: only signed-in admins can see this page. <Link className="underline" href={`/admin/spotlights/${spotlight.id}`}>Back to editing</Link>
        </p>
      ) : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(spotlight)).replace(/</g, "\\u003c") }} />
      )}

      <article className="px-5 pt-8 pb-14 sm:px-10 sm:pt-12 sm:pb-20 lg:px-[72px]">
        <div className="mx-auto max-w-[1296px]">
          <Link href="/spotlights" className={`inline-flex min-h-11 items-center text-[15px] font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
            <span aria-hidden="true" className="mr-1">←</span> Spotlights
          </Link>

          {spotlight.hero_image_url ? (
            <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-3xl bg-sky sm:aspect-[21/9]">
              <Image src={spotlight.hero_image_url} alt={spotlight.hero_image_alt ?? ""} fill preload sizes="(min-width: 1296px) 1296px, 100vw" className="object-cover" />
            </div>
          ) : null}

          <div className={`mt-10 grid gap-12 ${hasSidebar ? "lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16" : ""}`}>
            <div className="max-w-[720px] min-w-0">
              <header>
                <h1 className="font-serif text-[40px] leading-[1.05] font-medium tracking-[-0.01em] text-navy sm:text-[56px]">{spotlight.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-[15px] font-bold tracking-[1.8px] text-clay uppercase">{spotlight.maker_name}</p>
                  {spotlight.maker_category ? <CategoryChip category={spotlight.maker_category} /> : null}
                </div>
                {spotlight.summary ? <p className="mt-6 text-xl leading-normal text-ink-muted sm:text-[22px]">{spotlight.summary}</p> : null}
              </header>

              {blocks.length ? (
                <div className="mt-10 space-y-5 text-[17px] leading-[1.7] text-navy lg:text-lg">
                  {blocks.map((block, index) => block.type === "heading"
                    ? <h2 key={index} className="pt-4 font-serif text-[28px] leading-tight font-semibold text-navy sm:text-[32px]">{block.text}</h2>
                    : <p key={index} className="whitespace-pre-line">{block.text}</p>)}
                </div>
              ) : null}

              {photos.length ? (
                <section aria-label="Photos" className="mt-12 grid gap-6 sm:grid-cols-2">
                  {photos.map((photo) => (
                    <figure key={photo.url} className={photos.length % 2 === 1 && photo === photos[0] ? "sm:col-span-2" : ""}>
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-sky">
                        <Image src={photo.url} alt={photo.alt} fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                      </div>
                      {photo.caption ? <figcaption className="mt-2 text-[15px] text-ink-muted">{photo.caption}</figcaption> : null}
                    </figure>
                  ))}
                </section>
              ) : null}

              {video ? (
                <section aria-labelledby="spotlight-video-heading" className="mt-12">
                  <h2 id="spotlight-video-heading" className="font-serif text-[28px] leading-tight font-semibold text-navy">Video</h2>
                  <div className="mt-4">
                    {video.kind === "link" ? (
                      <a href={video.url} target="_blank" rel="noopener noreferrer" className={primaryButtonClass}>
                        Watch on {video.site} <span aria-hidden="true" className="ml-1">↗</span>
                      </a>
                    ) : (
                      <SpotlightVideo embedUrl={video.embedUrl} provider={video.kind === "youtube" ? "YouTube" : "Vimeo"} title={`Video: ${spotlight.title}`} />
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            {hasSidebar ? (
              <aside aria-label={`More about ${spotlight.maker_name}`} className="flex flex-col gap-6">
                {appearances.length ? (
                  <section aria-labelledby="find-them-heading" className={sidebarCardClass}>
                    <h2 id="find-them-heading" className={sidebarHeadingClass}>Find them at</h2>
                    <ul className="mt-4 divide-y divide-line">
                      {appearances.map((appearance) => (
                        <li key={appearance.slug} className="py-3 first:pt-0 last:pb-0">
                          <Link href={`/markets/${appearance.slug}`} className={`font-serif text-xl leading-tight font-semibold text-navy underline decoration-line-strong underline-offset-4 hover:decoration-navy ${focusRingClass}`}>{appearance.name}</Link>
                          <p className="mt-1 text-[15px] text-ink-muted">{formatAppearanceDates(appearance.dates)}</p>
                          {formatBooths(appearance.booths) ? <p className="text-[15px] text-ink-muted">{formatBooths(appearance.booths)}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {vendor?.dropvine_direct_url ? (
                  <section aria-labelledby="direct-heading" className={sidebarCardClass}>
                    <h2 id="direct-heading" className={sidebarHeadingClass}>Also on Dropvine Direct</h2>
                    <a href={vendor.dropvine_direct_url} target="_blank" rel="noopener noreferrer" className={`mt-4 ${directButtonClass}`}>
                      Visit their Dropvine Direct page <span aria-hidden="true" className="ml-1">↗</span>
                    </a>
                    <p className="mt-3 text-sm text-ink-muted">Opens dropvine.pro, our sister site.</p>
                  </section>
                ) : null}

                {links.length ? (
                  <section aria-labelledby="elsewhere-heading" className={sidebarCardClass}>
                    <h2 id="elsewhere-heading" className={sidebarHeadingClass}>Elsewhere</h2>
                    <ul className="mt-3">
                      {links.map((link) => (
                        <li key={`${link.label}-${link.url}`}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
                            {link.label} <span aria-hidden="true" className="ml-1">↗</span>
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      </article>
    </main>
  );
}
