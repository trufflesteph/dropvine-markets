import Link from "next/link";

import { hasAdminSession } from "@/lib/admin-auth";
import { saveSpotlight } from "../../actions";
import { buttonClass, loadVendorOptions, SignInPrompt } from "../../spotlight-admin";
import SpotlightForm from "../../spotlight-form";

export default async function NewSpotlightPage() {
  if (!(await hasAdminSession())) return <SignInPrompt />;
  const vendors = await loadVendorOptions();

  return <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14">
    <header className="flex items-start justify-between gap-6 border-b border-black/10 pb-6">
      <div>
        <Link className="text-sm text-black/55 underline decoration-black/25 underline-offset-4" href="/admin/spotlights">Spotlights</Link>
        <h1 className="mt-3 font-serif text-4xl">New spotlight</h1>
        <p className="mt-1 text-sm text-black/60">It starts as a draft. Add images after creating it.</p>
      </div>
      <Link className={buttonClass} href="/admin/spotlights">Back to spotlights</Link>
    </header>
    <section className="max-w-3xl"><SpotlightForm action={saveSpotlight} vendors={vendors} /></section>
  </main>;
}
