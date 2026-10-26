import Link from "next/link";

import { supabaseAdminFetch } from "@/lib/supabase-admin";
import { setSpotlightStatus } from "./actions";
import SubmitButton from "./submit-button";

// Shared by the spotlight admin pages.

export const buttonClass = "border border-black/20 px-3 py-2 text-sm hover:border-black";
export const primaryButtonClass = "bg-black px-3 py-2 text-sm text-white";

const errorMessages: Record<string, string> = {
  permission: "Check “I have this maker’s written permission to feature them” and save before publishing.",
  alt: "Alt text is required for every image.",
  "image-missing": "Choose an image to upload.",
  "image-type": "Images must be JPEG, PNG, GIF, WebP or AVIF.",
  "image-size": "Each image must be 4 MB or smaller.",
  "photo-limit": "A spotlight can have up to 4 photos. Remove one first.",
};

export function AdminNotice({ error, success }: { error?: string; success?: string }) {
  const message = error ? errorMessages[error] ?? "Something went wrong." : null;
  if (message) return <p className="border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{message}</p>;
  if (success) return <p className="border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">{success}</p>;
  return null;
}

export function SignInPrompt() {
  return <main className="flex min-h-screen items-center justify-center px-6 py-16"><p>Sign in through <Link className="underline" href="/admin">admin</Link>.</p></main>;
}

export function StatusButton({ id, status, returnTo }: { id: string; status: string; returnTo?: "list" }) {
  const publish = status !== "published";
  return <form action={setSpotlightStatus}>
    <input name="id" type="hidden" value={id} />
    <input name="status" type="hidden" value={publish ? "published" : "draft"} />
    {returnTo ? <input name="return_to" type="hidden" value={returnTo} /> : null}
    <SubmitButton className={publish ? primaryButtonClass : buttonClass} pendingLabel={publish ? "Publishing..." : "Unpublishing..."}>{publish ? "Publish" : "Unpublish"}</SubmitButton>
  </form>;
}

export async function adminJson<T>(path: string): Promise<T> {
  const response = await supabaseAdminFetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function loadVendorOptions() {
  return adminJson<{ id: string; business_name: string; category: string }[]>("vendors?select=id,business_name,category&order=business_name.asc");
}
