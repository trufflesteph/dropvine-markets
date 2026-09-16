"use client";

import { useState } from "react";

import SubmitButton from "./submit-button";

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

type VendorFormProps = {
  vendor?: Vendor;
  saveAction: (formData: FormData) => Promise<void>;
  uploadAction: (formData: FormData) => Promise<void>;
};

const inputClass = "mt-1 w-full border border-black/20 bg-white px-3 py-2 text-sm";
const primaryButtonClass = "bg-black px-3 py-2 text-sm text-white";

function Field({ label, name, defaultValue, disabled = false }: { label: string; name: string; defaultValue?: string | null; disabled?: boolean }) {
  return <label className="block text-sm"><span>{label}</span><input className={inputClass} name={name} defaultValue={defaultValue ?? ""} disabled={disabled} /></label>;
}

export default function VendorForm({ vendor, saveAction, uploadAction }: VendorFormProps) {
  const [direct, setDirect] = useState(Boolean(vendor?.dropvine_direct_url));

  return <div className="space-y-3">
    <form action={saveAction} className="space-y-4 border border-black/10 bg-white/60 p-5">
      {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
      <input type="hidden" name="photo_url" value={vendor?.photo_url ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Business name" name="business_name" defaultValue={vendor?.business_name} />
        <Field label="Slug" name="slug" defaultValue={vendor?.slug} />
        <Field label="Business category" name="category" defaultValue={vendor?.category} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="use_dropvine_direct" type="checkbox" checked={direct} onChange={(event) => setDirect(event.target.checked)} />
        Also on Dropvine Direct?
      </label>
      {direct ? <Field label="Dropvine Direct URL" name="dropvine_direct_url" defaultValue={vendor?.dropvine_direct_url} /> : <Field label="Website or Instagram URL" name="external_url" defaultValue={vendor?.external_url} />}
      {direct ? <p className="border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-800">This vendor links directly to Dropvine Direct. The market photo and external URL are not used.</p> : <div className="space-y-3"><p className="text-sm text-black/55">Upload a vendor photo below to replace the current image.</p><textarea className={inputClass} name="blurb" defaultValue={vendor?.blurb ?? ""} rows={3} aria-label="Blurb" /></div>}
      <SubmitButton className={primaryButtonClass} pendingLabel="Saving vendor...">{vendor ? "Save vendor" : "Create vendor"}</SubmitButton>
    </form>
    {vendor && !direct ? <form action={uploadAction} className="border border-black/10 p-4"><input name="vendor_id" type="hidden" value={vendor.id} /><label className="block text-sm"><span>Photo</span><input accept="image/*" className="mt-1 block text-sm" name="photo" type="file" required /></label><SubmitButton className="mt-3 border border-black/20 px-3 py-2 text-sm" pendingLabel="Uploading photo...">Upload photo</SubmitButton></form> : null}
  </div>;
}
