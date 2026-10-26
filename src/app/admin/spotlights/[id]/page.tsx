import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hasAdminSession } from "@/lib/admin-auth";
import type { Spotlight } from "@/lib/spotlights-data";
import { spotlightImageTypes, spotlightMaxPhotos } from "@/lib/spotlights";
import { deleteSpotlight, saveSpotlight, updateSpotlightImage, uploadSpotlightImage } from "../../actions";
import DeleteSpotlightControl from "../../delete-spotlight-control";
import { AdminNotice, adminJson, buttonClass, loadVendorOptions, SignInPrompt, StatusButton } from "../../spotlight-admin";
import SpotlightForm from "../../spotlight-form";
import SubmitButton from "../../submit-button";

const inputClass = "mt-1 w-full border border-black/20 bg-white px-3 py-2 text-sm";
const accept = spotlightImageTypes.join(",");

function UploadForm({ id, slot }: { id: string; slot: "hero" | "photo" }) {
  return <form action={uploadSpotlightImage} className="mt-4 space-y-3 border border-black/10 p-4">
    <input name="id" type="hidden" value={id} /><input name="slot" type="hidden" value={slot} />
    <label className="block text-sm"><span>Image (JPEG, PNG, GIF, WebP or AVIF, 4 MB at most)</span><input accept={accept} className="mt-1 block text-sm" name="image" type="file" required /></label>
    <label className="block text-sm"><span>Alt text (describe the image for people who can’t see it)</span><input className={inputClass} name="alt" required /></label>
    {slot === "photo" ? <label className="block text-sm"><span>Caption (optional)</span><input className={inputClass} name="caption" /></label> : null}
    <SubmitButton className={buttonClass} pendingLabel="Uploading...">{slot === "hero" ? "Upload hero image" : "Add photo"}</SubmitButton>
  </form>;
}

function ImageEditor({ id, target, url, alt, caption, index, count }: { id: string; target: string; url: string; alt: string | null; caption?: string | null; index?: number; count?: number }) {
  return <div className="grid gap-4 border border-black/10 bg-white p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
    <div className="relative aspect-[4/3] bg-[#F2F0EA]"><Image src={url} alt="" fill sizes="160px" className="object-cover" /></div>
    <div className="space-y-3">
      <form action={updateSpotlightImage} className="space-y-2">
        <input name="id" type="hidden" value={id} /><input name="target" type="hidden" value={target} />
        <label className="block text-sm"><span>Alt text</span><input className={inputClass} name="alt" defaultValue={alt ?? ""} required /></label>
        {caption !== undefined ? <label className="block text-sm"><span>Caption (optional)</span><input className={inputClass} name="caption" defaultValue={caption ?? ""} /></label> : null}
        <SubmitButton className={buttonClass} pendingLabel="Saving...">Save text</SubmitButton>
      </form>
      <div className="flex flex-wrap gap-3">
        {index !== undefined && count !== undefined ? <>
          {index > 0 ? <form action={updateSpotlightImage}><input name="id" type="hidden" value={id} /><input name="target" type="hidden" value={target} /><input name="move" type="hidden" value="-1" /><SubmitButton className="text-sm underline" pendingLabel="Moving...">Move earlier</SubmitButton></form> : null}
          {index < count - 1 ? <form action={updateSpotlightImage}><input name="id" type="hidden" value={id} /><input name="target" type="hidden" value={target} /><input name="move" type="hidden" value="1" /><SubmitButton className="text-sm underline" pendingLabel="Moving...">Move later</SubmitButton></form> : null}
        </> : null}
        <form action={updateSpotlightImage}><input name="id" type="hidden" value={id} /><input name="target" type="hidden" value={target} /><input name="remove" type="hidden" value="yes" /><SubmitButton className="text-sm text-red-700" pendingLabel="Removing...">Remove image</SubmitButton></form>
      </div>
    </div>
  </div>;
}

export default async function EditSpotlightPage({ params, searchParams }: PageProps<"/admin/spotlights/[id]">) {
  if (!(await hasAdminSession())) return <SignInPrompt />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [rows, vendors] = await Promise.all([
    adminJson<Spotlight[]>(`spotlights?id=eq.${encodeURIComponent(id)}&select=*`),
    loadVendorOptions(),
  ]);
  const spotlight = rows[0];
  if (!spotlight) notFound();
  const error = typeof query.error === "string" ? query.error : undefined;
  const success = query.created ? "Draft created. Add images below, then publish when it’s ready." : query.saved ? "Saved." : undefined;

  return <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14">
    <header className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link className="text-sm text-black/55 underline decoration-black/25 underline-offset-4" href="/admin/spotlights">Spotlights</Link>
        <h1 className="mt-3 font-serif text-4xl">Edit {spotlight.title}</h1>
        <p className="mt-1 text-sm text-black/60"><span className="uppercase tracking-wide">{spotlight.status}</span>{spotlight.status === "draft" ? " · only you can see the preview" : ""}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a className={buttonClass} href={`/spotlights/${spotlight.slug}`} target="_blank" rel="noopener noreferrer">{spotlight.status === "published" ? "View page" : "Preview page"}</a>
        <StatusButton id={spotlight.id} status={spotlight.status} />
      </div>
    </header>
    <AdminNotice error={error} success={success} />

    <section className="max-w-3xl">
      <SpotlightForm action={saveSpotlight} vendors={vendors} spotlight={spotlight} />
    </section>

    <section className="max-w-3xl border border-black/10 bg-white/60 p-5">
      <h2 className="font-serif text-2xl">Hero image</h2>
      <p className="mt-1 text-sm text-black/60">Shown at the top of the page, on cards, and when the page is shared.</p>
      {spotlight.hero_image_url ? <div className="mt-4"><ImageEditor id={spotlight.id} target="hero" url={spotlight.hero_image_url} alt={spotlight.hero_image_alt} /></div> : null}
      <UploadForm id={spotlight.id} slot="hero" />
    </section>

    <section className="max-w-3xl border border-black/10 bg-white/60 p-5">
      <div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl">Photos</h2><span className="text-sm text-black/55">{spotlight.photos.length}/{spotlightMaxPhotos}</span></div>
      <div className="mt-4 space-y-3">
        {spotlight.photos.map((photo, index) => <ImageEditor key={photo.url} id={spotlight.id} target={String(index)} url={photo.url} alt={photo.alt} caption={photo.caption} index={index} count={spotlight.photos.length} />)}
      </div>
      {spotlight.photos.length < spotlightMaxPhotos ? <UploadForm id={spotlight.id} slot="photo" /> : <p className="mt-4 text-sm text-black/60">That’s the maximum of {spotlightMaxPhotos} photos. Remove one to add another.</p>}
    </section>

    <section className="flex max-w-3xl flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
      <Link className={buttonClass} href="/admin/spotlights">Back to spotlights</Link>
      <DeleteSpotlightControl action={deleteSpotlight} spotlightId={spotlight.id} title={spotlight.title} />
    </section>
  </main>;
}
