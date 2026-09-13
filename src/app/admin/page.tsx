import { hasAdminSession } from "@/lib/admin-auth";
import { supabaseAdminFetch } from "@/lib/supabase-admin";
import {
  createMarket, createMarketDate, createMarketVendorLink, createVendor,
  deleteMarket, deleteMarketDate, deleteMarketVendorLink, deleteVendor,
  deleteMarketPhoto, importVendorsFromCsv, reorderMarketPhotos, updateMarket, updateMarketDate, updateMarketVendorLink, updateVendor, uploadMarketPhotos,
} from "./actions";
import CsvVendorImport from "./csv-vendor-import";
import MarketPhotoManager from "./market-photo-manager";

type Market = {
  id: string; slug: string; name: string; market_type: string; description: string | null;
  city: string; state: string; address: string | null; latitude: number | null; longitude: number | null;
  hero_image_url: string | null; map_image_url: string | null; organizer_name: string | null;
  organizer_url: string | null; status: "draft" | "published";
  photos?: MarketPhoto[];
};
type MarketDate = { id: string; market_id: string; date: string; start_time: string | null; end_time: string | null; is_canceled: boolean; note: string | null };
type Vendor = { id: string; slug: string; business_name: string; category: string; photo_url: string | null; blurb: string | null; dropvine_direct_url: string | null; external_url: string | null };
type Link = { id: string; market_id: string; vendor_id: string; map_x: number | null; map_y: number | null; booth_label: string | null; featured: boolean; vendor: Vendor };
type MarketPhoto = { id: string; market_id: string; photo_url: string; sort_order: number };
type AdminPageProps = { searchParams: Promise<{ error?: string; market?: string; new?: string }> };

const inputClass = "mt-1 w-full border border-black/20 bg-white px-3 py-2 text-sm";
const buttonClass = "border border-black/20 px-3 py-2 text-sm hover:border-black";
const primaryButtonClass = "bg-black px-3 py-2 text-sm text-white";
const marketTypes = ["Farmers", "Artisan-Craft", "Holiday", "Night", "Popup", "Vintage-Flea", "Other"];

function Field({ label, name, defaultValue, type = "text", required = false, disabled = false }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; disabled?: boolean }) {
  return <label className="block text-sm"><span>{label}</span><input className={inputClass} name={name} defaultValue={defaultValue ?? ""} type={type} required={required} disabled={disabled} /></label>;
}

function TextArea({ label, name, defaultValue, disabled = false }: { label: string; name: string; defaultValue?: string | null; disabled?: boolean }) {
  return <label className="block text-sm"><span>{label}</span><textarea className={inputClass} name={name} defaultValue={defaultValue ?? ""} rows={3} disabled={disabled} /></label>;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await supabaseAdminFetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function loadAdminData() {
  const [markets, dates, vendors, links, photos] = await Promise.all([
    fetchJson<Market[]>("markets?select=*&order=name.asc"),
    fetchJson<MarketDate[]>("market_dates?select=*&order=date.asc"),
    fetchJson<Vendor[]>("vendors?select=*&order=business_name.asc"),
    fetchJson<(Omit<Link, "vendor"> & { vendors: Vendor })[]>("market_vendor_links?select=*,vendors(*)&order=booth_label.asc"),
    fetchJson<MarketPhoto[]>("market_photos?select=*&order=market_id.asc,sort_order.asc"),
  ]);
  return { markets: markets.map((market) => ({ ...market, photos: photos.filter((photo) => photo.market_id === market.id) })), dates, vendors, links: links.map((link) => ({ ...link, vendor: link.vendors })), photos };
}

function MarketForm({ market }: { market?: Market }) {
  return <><form action={market ? updateMarket : createMarket} className="space-y-4 border border-black/10 bg-white/60 p-5">
    {market ? <input type="hidden" name="id" value={market.id} /> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Name" name="name" defaultValue={market?.name} required /><Field label="Slug" name="slug" defaultValue={market?.slug} required /><Field label="City" name="city" defaultValue={market?.city} required /><Field label="State" name="state" defaultValue={market?.state} required /><Field label="Address" name="address" defaultValue={market?.address} /><label className="block text-sm"><span>Market type</span><select className={inputClass} name="market_type" defaultValue={market?.market_type ?? "Farmers"} required><option value="">Select a type</option>{marketTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><Field label="Latitude" name="latitude" defaultValue={market?.latitude} type="number" /><Field label="Longitude" name="longitude" defaultValue={market?.longitude} type="number" /><Field label="Map image URL" name="map_image_url" defaultValue={market?.map_image_url} /><Field label="Organizer name" name="organizer_name" defaultValue={market?.organizer_name} /><Field label="Organizer URL" name="organizer_url" defaultValue={market?.organizer_url} /></div>
    {market && !marketTypes.includes(market.market_type) ? <p className="border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm text-amber-900">This market has an invalid type value, <strong>{market.market_type}</strong>. Choose a valid type and save it manually.</p> : null}
    <TextArea label="Description" name="description" defaultValue={market?.description} />
    <label className="block text-sm"><span>Status</span><select className={inputClass} name="status" defaultValue={market?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Published</option></select></label>
    <button className={primaryButtonClass} type="submit">{market ? "Save market" : "Create market"}</button>
  </form>{market ? <MarketPhotoManager deleteAction={deleteMarketPhoto} marketId={market.id} photos={market.photos ?? []} reorderAction={reorderMarketPhotos} uploadAction={uploadMarketPhotos} /> : null}</>;
}

function DateForm({ marketId, date }: { marketId: string; date?: MarketDate }) {
  return <form action={date ? updateMarketDate : createMarketDate} className="space-y-3 border border-black/10 p-4">
    {date ? <input type="hidden" name="id" value={date.id} /> : null}<input type="hidden" name="market_id" value={marketId} />
    <div className="grid gap-3 md:grid-cols-3"><Field label="Date" name="date" defaultValue={date?.date} type="date" required /><Field label="Start" name="start_time" defaultValue={date?.start_time?.slice(0, 5)} type="time" /><Field label="End" name="end_time" defaultValue={date?.end_time?.slice(0, 5)} type="time" /></div>
    <TextArea label="Cancellation or date note" name="note" defaultValue={date?.note} />
    <label className="flex items-center gap-2 text-sm"><input name="is_canceled" type="checkbox" defaultChecked={date?.is_canceled} /> Canceled</label>
    <button className={buttonClass} type="submit">{date ? "Save date" : "Add date"}</button>
  </form>;
}

function VendorForm({ vendor }: { vendor?: Vendor }) {
  const direct = Boolean(vendor?.dropvine_direct_url);
  return <form action={vendor ? updateVendor : createVendor} className="space-y-4 border border-black/10 bg-white/60 p-5">
    {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Business name" name="business_name" defaultValue={vendor?.business_name} required /><Field label="Slug" name="slug" defaultValue={vendor?.slug} required /><Field label="Category" name="category" defaultValue={vendor?.category} required /><Field label="Dropvine Direct URL" name="dropvine_direct_url" defaultValue={vendor?.dropvine_direct_url} /></div>
    {direct ? <p className="border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-800">Linked to Dropvine Direct. Markets-native fields are disabled.</p> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Photo URL" name="photo_url" defaultValue={vendor?.photo_url} disabled={direct} /><Field label="External URL" name="external_url" defaultValue={vendor?.external_url} disabled={direct} /></div>
    <TextArea label="Blurb" name="blurb" defaultValue={vendor?.blurb} disabled={direct} />
    <button className={primaryButtonClass} type="submit">{vendor ? "Save vendor" : "Create vendor"}</button>
  </form>;
}

function LinkForm({ marketId, vendors, link, hasMap }: { marketId: string; vendors: Vendor[]; link?: Link; hasMap: boolean }) {
  return <form action={link ? updateMarketVendorLink : createMarketVendorLink} className="space-y-3 border border-black/10 p-4">
    {link ? <input type="hidden" name="id" value={link.id} /> : null}<input type="hidden" name="market_id" value={marketId} />
    <label className="block text-sm"><span>Vendor</span><select className={inputClass} name="vendor_id" defaultValue={link?.vendor_id ?? ""} required disabled={Boolean(link)}><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.business_name}</option>)}</select>{link ? <input name="vendor_id" type="hidden" value={link.vendor_id} /> : null}</label>
    {hasMap ? <div className="grid gap-3 md:grid-cols-3"><Field label="Map X (0-100)" name="map_x" defaultValue={link?.map_x} type="number" /><Field label="Map Y (0-100)" name="map_y" defaultValue={link?.map_y} type="number" /><Field label="Booth label" name="booth_label" defaultValue={link?.booth_label} /></div> : <p className="text-sm text-black/55">Add a map image URL to this market to position booths.</p>}
    <label className="flex items-center gap-2 text-sm"><input name="featured" type="checkbox" defaultChecked={link?.featured} /> Featured</label>
    <button className={buttonClass} type="submit">{link ? "Save link" : "Add vendor to market"}</button>
  </form>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!(await hasAdminSession())) {
    const { error } = await searchParams;
    return <main className="flex min-h-screen items-center justify-center px-6 py-16"><section className="w-full max-w-md border border-black/10 bg-white/60 p-8"><p className="text-sm uppercase tracking-[0.2em] text-black/50">Dropvine Markets</p><h1 className="mt-3 font-serif text-4xl">Admin sign in</h1><form action="/api/admin/login" className="mt-8 space-y-5" method="post"><label className="block text-sm" htmlFor="password">Password</label><input autoComplete="current-password" className={inputClass} id="password" name="password" required type="password" />{error === "invalid" ? <p className="text-sm text-red-700">That password was not accepted.</p> : null}<button className="w-full bg-black px-4 py-3 text-sm text-white" type="submit">Sign in</button></form></section></main>;
  }

  const params = await searchParams;
  const data = await loadAdminData();
  const selected = params.market ? data.markets.find((market) => market.id === params.market) : undefined;
  const showNewMarket = params.new === "1";
  const selectedDates = selected ? data.dates.filter((date) => date.market_id === selected.id) : [];
  const selectedLinks = selected ? data.links.filter((link) => link.market_id === selected.id) : [];
  const linkedVendorIds = new Set(selectedLinks.map((link) => link.vendor_id));
  const availableVendors = data.vendors.filter((vendor) => !linkedVendorIds.has(vendor.id));

  return <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10"><header className="flex items-center justify-between gap-6 border-b border-black/10 pb-6"><div><p className="text-sm uppercase tracking-[0.2em] text-black/50">Dropvine Markets</p><h1 className="mt-2 font-serif text-4xl">Admin</h1></div><form action="/api/admin/logout" method="post"><button className={buttonClass} type="submit">Sign out</button></form></header>
    {showNewMarket ? <section className="max-w-3xl"><div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-black/50">Markets</p><h2 className="mt-2 font-serif text-3xl">New market</h2></div><a className={buttonClass} href="/admin">Back to markets</a></div><MarketForm /></section> : selected ? <><section className="flex items-start justify-between gap-4 border-b border-black/10 pb-6"><div><a className="text-sm text-black/55 underline decoration-black/25 underline-offset-4" href="/admin">All markets</a><h2 className="mt-3 font-serif text-3xl">Edit {selected.name}</h2></div><a className={buttonClass} href="/admin">Back to markets</a></section><section className="max-w-3xl"><MarketForm market={selected} /></section><section className="grid gap-8 lg:grid-cols-2"><div><h2 className="mb-4 font-serif text-2xl">Dates</h2><div className="space-y-3">{selectedDates.map((date) => <div key={date.id}><DateForm marketId={selected.id} date={date} /><form action={deleteMarketDate} className="mt-1"><input name="id" type="hidden" value={date.id} /><input name="market_id" type="hidden" value={selected.id} /><button className="text-sm text-red-700" type="submit">Remove date</button></form></div>)}<DateForm marketId={selected.id} /></div></div><div><h2 className="mb-4 font-serif text-2xl">Vendors at this market</h2><div className="space-y-3">{selectedLinks.map((link) => <div key={link.id}><p className="mb-2 font-medium">{link.vendor.business_name}</p><LinkForm marketId={selected.id} vendors={data.vendors} link={link} hasMap={Boolean(selected.map_image_url)} /><form action={deleteMarketVendorLink} className="mt-1"><input name="id" type="hidden" value={link.id} /><input name="market_id" type="hidden" value={selected.id} /><button className="text-sm text-red-700" type="submit">Remove vendor</button></form></div>)}<LinkForm marketId={selected.id} vendors={availableVendors} hasMap={Boolean(selected.map_image_url)} /><CsvVendorImport action={importVendorsFromCsv} marketId={selected.id} /></div></div></section><section><h2 className="mb-4 font-serif text-2xl">Vendor records</h2><div className="grid gap-6 lg:grid-cols-2">{selectedLinks.map((link) => <div key={link.vendor.id}><VendorForm vendor={link.vendor} /><form action={deleteVendor} className="mt-1"><input name="id" type="hidden" value={link.vendor.id} /><button className="text-sm text-red-700" type="submit">Delete vendor</button></form></div>)}<VendorForm /></div></section></> : <section><div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-black/50">Administration</p><h2 className="mt-2 font-serif text-3xl">Markets</h2></div><a className={primaryButtonClass} href="/admin?new=1">New market</a></div><div className="border border-black/10">{data.markets.length ? data.markets.map((market) => <article className="flex items-center justify-between gap-4 border-b border-black/10 p-4 last:border-b-0" key={market.id}><div><a href={`/admin?market=${market.id}`}><h3 className="font-serif text-xl">{market.name}</h3></a><p className="mt-1 text-sm text-black/60">{market.market_type}</p>{!marketTypes.includes(market.market_type) ? <p className="mt-1 text-sm text-amber-800">Invalid market type. Select and fix manually.</p> : null}</div><div className="flex items-center gap-4"><span className="text-xs uppercase tracking-wide">{market.status}</span><form action={deleteMarket}><input name="id" type="hidden" value={market.id} /><button className="text-sm text-red-700" type="submit">Delete</button></form></div></article>) : <p className="p-6 text-sm text-black/60">No markets yet.</p>}</div></section>}
  </main>;
}
