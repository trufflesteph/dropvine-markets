"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import StallPlaceholder from "@/components/stall-placeholder";
import { focusRingClass } from "@/components/styles";
import { formatDateRange, formatPlace } from "@/lib/market-format";

export type GridMarket = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  city: string;
  state: string;
  hero_image_url: string | null;
  next_date: string | null;
  next_date_end: string | null;
  vendor_count: number;
};

type DateFilter = "all" | "weekend" | "month";
type SortOrder = "soonest" | "furthest";

const labelClass = "flex w-full items-center gap-3 sm:w-auto";
const labelTextClass = "w-20 shrink-0 text-[15px] font-medium text-ink-muted sm:w-auto";
const selectClass = "min-h-12 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line-strong bg-white px-3 text-[15px] font-medium text-navy outline-none focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/25 sm:min-h-11 sm:flex-none";

function isInDateFilter(value: string | null, filter: DateFilter) {
  if (filter === "all" || !value) return true;

  const date = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (filter === "month") {
    return date.getUTCFullYear() === today.getUTCFullYear() && date.getUTCMonth() === today.getUTCMonth();
  }

  const day = today.getUTCDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const weekendStart = new Date(today);
  weekendStart.setUTCDate(today.getUTCDate() + daysUntilSaturday);
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setUTCDate(weekendStart.getUTCDate() + 1);

  return date >= weekendStart && date <= weekendEnd;
}

export default function MarketGrid({ markets }: { markets: GridMarket[] }) {
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("soonest");

  const types = useMemo(() => [...new Set(markets.map((market) => market.market_type))].sort(), [markets]);
  const locations = useMemo(
    () => [...new Set(markets.map((market) => `${market.city}, ${market.state}`))].sort(),
    [markets],
  );

  const filteredMarkets = useMemo(() => {
    return markets
      .filter((market) => type === "all" || market.market_type === type)
      .filter((market) => location === "all" || `${market.city}, ${market.state}` === location)
      .filter((market) => isInDateFilter(market.next_date, dateFilter))
      .sort((first, second) => {
        if (!first.next_date && !second.next_date) return first.name.localeCompare(second.name);
        if (!first.next_date) return 1;
        if (!second.next_date) return -1;
        const difference = first.next_date.localeCompare(second.next_date);
        return sortOrder === "soonest" ? difference : -difference;
      });
  }, [dateFilter, location, markets, sortOrder, type]);

  return (
    <>
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
                    {formatDateRange(market.next_date, market.next_date_end)} · {market.market_type}
                  </p>
                  <h3 className="mt-2 font-serif text-[25px] leading-[1.1] font-semibold text-navy sm:text-[28px]">{market.name}</h3>
                  <p className="mt-2 text-[15px] text-ink-muted">{formatPlace(market.city, market.state, market.vendor_count)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[20px] border border-line bg-white px-5 py-10 text-center text-[15px] text-ink-muted">
          No upcoming markets match. Know of one? Suggest it below.
        </p>
      )}
    </>
  );
}
