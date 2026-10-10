"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import StallPlaceholder from "@/components/stall-placeholder";
import { focusRingClass } from "@/components/styles";
import { type CategoryGroupSlug, categoryGroups, filterByCategoryGroups } from "@/lib/category-groups";
import { type DateFilter, formatDateRange, formatPlace, isInDateFilter, todayInLosAngeles } from "@/lib/market-format";

export type GridMarket = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  city: string;
  state: string;
  hero_image_url: string | null;
  /** First day of the current run of dates (may be before today); for display. */
  range_start: string | null;
  /** First date on or after today; for filtering and sorting. */
  next_date: string | null;
  next_date_end: string | null;
  vendor_count: number;
  /** Category group slugs of the market's publicly visible vendors. */
  category_groups: CategoryGroupSlug[];
};

type SortOrder = "soonest" | "furthest";

const chipFocusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

// Mirror the chip selection into ?category= without a navigation, keeping any other query params and the hash.
function syncCategoryParam(selected: readonly string[]) {
  const url = new URL(window.location.href);
  url.searchParams.delete("category");
  const rest = url.searchParams.toString();
  url.search = [rest, selected.length ? `category=${selected.join(",")}` : ""].filter(Boolean).join("&");
  window.history.replaceState(null, "", url);
}

const labelClass = "flex w-full items-center gap-3 sm:w-auto";
const labelTextClass = "w-20 shrink-0 text-[15px] font-medium text-ink-muted sm:w-auto";
const selectClass = "min-h-12 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line-strong bg-white px-3 text-[15px] font-medium text-navy outline-none focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/25 sm:min-h-11 sm:flex-none";

export default function MarketGrid({ markets, initialCategories }: { markets: GridMarket[]; initialCategories: CategoryGroupSlug[] }) {
  const [categories, setCategories] = useState<CategoryGroupSlug[]>(initialCategories);
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("soonest");

  const types = useMemo(() => [...new Set(markets.map((market) => market.market_type))].sort(), [markets]);
  const locations = useMemo(
    () => [...new Set(markets.map((market) => `${market.city}, ${market.state}`))].sort(),
    [markets],
  );

  // Every filter except category, so the empty state can tell whether the category is what emptied the list.
  const marketsBeforeCategory = useMemo(() => {
    const today = todayInLosAngeles();
    return markets
      .filter((market) => type === "all" || market.market_type === type)
      .filter((market) => location === "all" || `${market.city}, ${market.state}` === location)
      .filter((market) => isInDateFilter(market.next_date, market.next_date_end, dateFilter, today))
      .sort((first, second) => {
        if (!first.next_date && !second.next_date) return first.name.localeCompare(second.name);
        if (!first.next_date) return 1;
        if (!second.next_date) return -1;
        const difference = first.next_date.localeCompare(second.next_date);
        return sortOrder === "soonest" ? difference : -difference;
      });
  }, [dateFilter, location, markets, sortOrder, type]);
  const filteredMarkets = useMemo(() => filterByCategoryGroups(marketsBeforeCategory, categories), [categories, marketsBeforeCategory]);
  const categoryEmptiedList = categories.length > 0 && !filteredMarkets.length && marketsBeforeCategory.length > 0;

  // Drop unknown slugs from a shared or hand-typed ?category= link once the page loads.
  useEffect(() => {
    const raw = new URL(window.location.href).searchParams.get("category");
    if (raw !== null && raw !== initialCategories.join(",")) syncCategoryParam(initialCategories);
  }, [initialCategories]);

  function updateCategories(next: CategoryGroupSlug[]) {
    setCategories(next);
    syncCategoryParam(next);
  }

  function toggleCategory(slug: CategoryGroupSlug) {
    const next = categories.includes(slug) ? categories.filter((value) => value !== slug) : [...categories, slug];
    // Keep the URL in display order regardless of click order.
    updateCategories(categoryGroups.map((group) => group.slug).filter((value) => next.includes(value)));
  }

  return (
    <>
      <section aria-labelledby="category-band-heading" className="bg-sage-band px-5 py-6 sm:px-10 lg:px-[72px] lg:py-7">
        <div className="mx-auto flex max-w-[1296px] flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <h2 id="category-band-heading" className="shrink-0 text-[13px] font-bold tracking-[1.8px] text-navy uppercase">Shop by category</h2>
          <div role="group" aria-labelledby="category-band-heading" className="flex flex-wrap items-center gap-2">
            {categoryGroups.map((group) => {
              const selected = categories.includes(group.slug);
              return (
                <button
                  key={group.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCategory(group.slug)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-white px-3.5 py-2 text-sm leading-tight font-medium transition-colors sm:min-h-0 ${selected ? "bg-navy text-white hover:bg-navy-dark" : "bg-white text-navy hover:border-navy"} ${chipFocusClass}`}
                >
                  <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${selected ? "ring-2 ring-white" : ""}`} style={{ backgroundColor: group.color }} />
                  {group.label}
                </button>
              );
            })}
            {categories.length ? (
              <button
                type="button"
                onClick={() => updateCategories([])}
                aria-label="Clear category filter"
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-navy underline underline-offset-4 hover:decoration-2 sm:min-h-0 sm:py-2 ${chipFocusClass}`}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section id="markets" aria-labelledby="markets-heading" className="bg-paper px-5 py-10 sm:px-10 sm:pt-[72px] sm:pb-[88px] lg:px-[72px]">
        <div className="mx-auto max-w-[1296px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="markets-heading" className="font-serif text-4xl leading-tight font-medium text-navy sm:text-5xl">Upcoming markets</h2>
            <p className="text-[15px] text-ink-muted" aria-live="polite">
              {filteredMarkets.length} {filteredMarkets.length === 1 ? "market" : "markets"}
            </p>
          </div>

          <div className="mt-6 mb-8 flex flex-col gap-3 border-y border-line py-[18px] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
              <label className={labelClass}>
                <span className={labelTextClass}>Type</span>
                <select className={selectClass} value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="all">All types</option>
                  {types.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Location</span>
                <select className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)}>
                  <option value="all">All locations</option>
                  {locations.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Date</span>
                <select className={selectClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
                  <option value="all">Any upcoming date</option>
                  <option value="weekend">This weekend</option>
                  <option value="month">This month</option>
                </select>
              </label>
            </div>
            <label className={labelClass}>
              <span className={labelTextClass}>Sort</span>
              <select className={selectClass} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                <option value="soonest">Soonest first</option>
                <option value="furthest">Furthest first</option>
              </select>
            </label>
          </div>

          {filteredMarkets.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {filteredMarkets.map((market) => (
                <li key={market.id}>
                  <a
                    href={`/markets/${market.slug}`}
                    className={`group flex h-full flex-col overflow-hidden rounded-[20px] border border-line bg-white transition-[border-color,box-shadow] hover:border-line-hover hover:shadow-[0_10px_30px_-12px_rgba(29,52,97,0.18)] ${focusRingClass}`}
                  >
                    <div className="relative h-[170px] bg-sky sm:h-[220px]">
                      {market.hero_image_url ? (
                        <Image src={market.hero_image_url} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                      ) : (
                        <StallPlaceholder className="w-[130px] sm:w-[160px]" />
                      )}
                    </div>
                    <div className="px-6 pt-5 pb-6">
                      <p className="text-[13px] font-bold tracking-[1.8px] text-clay uppercase">
                        {formatDateRange(market.range_start, market.next_date_end)} · {market.market_type}
                      </p>
                      <h3 className="mt-2 font-serif text-[25px] leading-[1.1] font-semibold text-navy sm:text-[28px]">{market.name}</h3>
                      <p className="mt-2 text-[15px] text-ink-muted">{formatPlace(market.city, market.state, market.vendor_count)}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : categoryEmptiedList ? (
            <div className="rounded-[20px] border border-line bg-white px-5 py-10 text-center">
              <p className="text-[15px] text-ink-muted">No upcoming markets with makers in that category yet.</p>
              <button
                type="button"
                onClick={() => updateCategories([])}
                className={`mt-4 inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-line-strong bg-white px-5 text-[15px] font-bold text-navy transition-colors hover:border-navy ${focusRingClass}`}
              >
                Clear filter
              </button>
            </div>
          ) : (
            <p className="rounded-[20px] border border-line bg-white px-5 py-10 text-center text-[15px] text-ink-muted">
              No upcoming markets match. Know of one? Suggest it below.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
