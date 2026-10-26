"use client";

import { useActionState, useState } from "react";

import type { SpotlightFormState } from "./actions";
import SubmitButton from "./submit-button";
import { parseBody, type SpotlightLink, slugify, spotlightMaxLinks, spotlightSummaryMax } from "@/lib/spotlights";
import { vendorCategories } from "@/lib/vendor-categories";

export type SpotlightFormValues = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  maker_name: string;
  maker_category: string | null;
  vendor_id: string | null;
  video_url: string | null;
  links: SpotlightLink[];
  permission_confirmed: boolean;
  sort_order: number;
};
type VendorOption = { id: string; business_name: string; category: string };
type Props = {
  spotlight?: SpotlightFormValues;
  vendors: VendorOption[];
  action: (state: SpotlightFormState, formData: FormData) => Promise<SpotlightFormState>;
};

const inputClass = "mt-1 w-full border border-black/20 bg-white px-3 py-2 text-sm";
const primaryButtonClass = "bg-black px-3 py-2 text-sm text-white";

// Every field is controlled: React resets uncontrolled fields after an action, which would wipe the form when
// the server sends back a validation error.
export default function SpotlightForm({ spotlight, vendors, action }: Props) {
  const [state, formAction] = useActionState(action, { error: null });
  const [title, setTitle] = useState(spotlight?.title ?? "");
  const [slug, setSlug] = useState(spotlight?.slug ?? "");
  // A new spotlight's slug follows the title until it is edited by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(spotlight));
  const [summary, setSummary] = useState(spotlight?.summary ?? "");
  const [body, setBody] = useState(spotlight?.body ?? "");
  const [makerName, setMakerName] = useState(spotlight?.maker_name ?? "");
  const [category, setCategory] = useState(spotlight?.maker_category ?? "");
  const [vendorId, setVendorId] = useState(spotlight?.vendor_id ?? "");
  const [videoUrl, setVideoUrl] = useState(spotlight?.video_url ?? "");
  const [links, setLinks] = useState(() => Array.from({ length: spotlightMaxLinks }, (_, index) => spotlight?.links[index] ?? { label: "", url: "" }));
  const [permission, setPermission] = useState(spotlight?.permission_confirmed ?? false);
  const [sortOrder, setSortOrder] = useState(String(spotlight?.sort_order ?? 0));
  const [showPreview, setShowPreview] = useState(false);

  function changeTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  // Choosing a vendor fills the maker name and category when they are still empty.
  function changeVendor(value: string) {
    setVendorId(value);
    const vendor = vendors.find((option) => option.id === value);
    if (!vendor) return;
    if (!makerName.trim()) setMakerName(vendor.business_name);
    if (!category && (vendorCategories as readonly string[]).includes(vendor.category)) setCategory(vendor.category);
  }

  function changeLink(index: number, field: keyof SpotlightLink, value: string) {
    setLinks((current) => current.map((link, position) => position === index ? { ...link, [field]: value } : link));
  }

  const blocks = parseBody(body);

  return <form action={formAction} className="space-y-5 border border-black/10 bg-white/60 p-5">
    {spotlight ? <input type="hidden" name="id" value={spotlight.id} /> : null}
    {state.error ? <p className="border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{state.error}</p> : null}

    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm md:col-span-2"><span>Title</span><input className={inputClass} name="title" value={title} onChange={(event) => changeTitle(event.target.value)} required /></label>
      <label className="block text-sm md:col-span-2"><span>Slug (the page address: /spotlights/{slug || "…"})</span><input className={inputClass} name="slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} required /></label>
      <label className="block text-sm"><span>Link to a listed vendor (optional)</span><select className={inputClass} name="vendor_id" value={vendorId} onChange={(event) => changeVendor(event.target.value)}><option value="">No linked vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.business_name}</option>)}</select></label>
      <label className="block text-sm"><span>Maker name</span><input className={inputClass} name="maker_name" value={makerName} onChange={(event) => setMakerName(event.target.value)} required /></label>
      <label className="block text-sm"><span>Category (optional)</span><select className={inputClass} name="maker_category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">No category</option>{vendorCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="block text-sm"><span>Sort order (higher shows first; leave 0 for newest first)</span><input className={inputClass} name="sort_order" type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
    </div>

    <label className="block text-sm">
      <span className="flex justify-between gap-4"><span>Summary (shown on cards)</span><span className={summary.length > spotlightSummaryMax ? "text-red-700" : "text-black/55"}>{summary.length}/{spotlightSummaryMax}</span></span>
      <textarea className={inputClass} name="summary" rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={spotlightSummaryMax} />
    </label>

    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="spotlight-body">Body</label>
        <span className="text-black/55">{body.length.toLocaleString("en-US")} characters · {blocks.length} {blocks.length === 1 ? "block" : "blocks"}</span>
      </div>
      <p className="mt-1 text-black/55">Plain text. Leave a blank line between paragraphs. Start a line with “## ” for a subheading. Links and HTML are shown as typed.</p>
      <textarea className={`${inputClass} font-mono`} id="spotlight-body" name="body" rows={14} value={body} onChange={(event) => setBody(event.target.value)} />
      <button className="mt-2 border border-black/20 px-3 py-1.5 text-sm hover:border-black" type="button" aria-expanded={showPreview} onClick={() => setShowPreview((value) => !value)}>{showPreview ? "Hide preview" : "Show preview"}</button>
      {showPreview ? <div className="mt-3 space-y-4 border border-black/10 bg-white p-5">
        {blocks.length ? blocks.map((block, index) => block.type === "heading"
          ? <h3 key={index} className="font-serif text-2xl">{block.text}</h3>
          : <p key={index} className="whitespace-pre-line leading-relaxed">{block.text}</p>) : <p className="text-black/55">Nothing to preview yet.</p>}
      </div> : null}
    </div>

    <label className="block text-sm"><span>Video URL (optional; YouTube and Vimeo play on the page, other sites show a link)</span><input className={inputClass} name="video_url" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} /></label>

    <fieldset className="text-sm">
      <legend>Links, shown under “Elsewhere” (up to {spotlightMaxLinks})</legend>
      <div className="mt-1 space-y-2">
        {links.map((link, index) => <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <input aria-label={`Link ${index + 1} label`} className="w-full border border-black/20 bg-white px-3 py-2 text-sm" name={`link_label_${index}`} placeholder="Label, e.g. Instagram" value={link.label} onChange={(event) => changeLink(index, "label", event.target.value)} />
          <input aria-label={`Link ${index + 1} URL`} className="w-full border border-black/20 bg-white px-3 py-2 text-sm" name={`link_url_${index}`} placeholder="https://" type="url" value={link.url} onChange={(event) => changeLink(index, "url", event.target.value)} />
        </div>)}
      </div>
    </fieldset>

    <label className="flex items-start gap-2 border border-black/10 bg-white p-3 text-sm">
      <input className="mt-0.5" name="permission_confirmed" type="checkbox" checked={permission} onChange={(event) => setPermission(event.target.checked)} />
      <span><strong>I have this maker’s written permission to feature them.</strong> Required before publishing.</span>
    </label>

    <SubmitButton className={primaryButtonClass} pendingLabel="Saving spotlight...">{spotlight ? "Save spotlight" : "Create draft"}</SubmitButton>
  </form>;
}
