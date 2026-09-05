"use client";

import { useMemo, useState } from "react";

type Market = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  city: string;
  state: string;
  hero_image_url: string | null;
  next_date: string | null;
};

type DateFilter = "all" | "weekend" | "month";
type SortOrder = "soonest" | "furthest";

const selectClass = "border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black";

function formatDate(value: string | null) {
  if (!value) return "Dates coming soon";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

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

export default function MarketGrid({ markets }: { markets: Market[] }) {
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
    <section aria-label="Browse markets">
      <div className="mb-8 flex flex-col gap-4 border-y border-black/10 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-black/50">Type</span>
            <select className={selectClass} value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              {types.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-black/50">Location</span>
            <select className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="all">All locations</option>
              {locations.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-black/50">Date</span>
            <select className={selectClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
              <option value="all">Any upcoming date</option>
              <option value="weekend">This weekend</option>
              <option value="month">This month</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-black/50">Sort</span>
          <select className={selectClass} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
            <option value="soonest">Soonest first</option>
            <option value="furthest">Furthest first</option>
          </select>
        </label>
      </div>

      {filteredMarkets.length ? (
        <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMarkets.map((market) => (
            <article key={market.id} className="group">
              <div>
                <div
                  className="aspect-[4/3] border border-black/10 bg-[#F2F0EA] bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.01]"
                  style={market.hero_image_url ? { backgroundImage: `url(${market.hero_image_url})` } : undefined}
                >
                  {!market.hero_image_url ? <div className="flex h-full items-center justify-center px-6 text-center font-serif text-2xl text-black/35">Dropvine Markets</div> : null}
                </div>
                <div className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-serif text-2xl leading-tight">{market.name}</h2>
                    <span className="shrink-0 pt-1 text-xs uppercase tracking-[0.14em] text-black/45">{market.market_type}</span>
                  </div>
                  <p className="mt-2 text-sm text-black/60">{market.city}, {market.state}</p>
                  <p className="mt-4 text-sm">{formatDate(market.next_date)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="border border-black/10 px-5 py-10 text-center text-sm text-black/60">No markets match those filters.</p>
      )}
    </section>
  );
}
