import Link from "next/link";

import { hasAdminSession } from "@/lib/admin-auth";
import type { Spotlight } from "@/lib/spotlights-data";
import { deleteSpotlight } from "../actions";
import DeleteSpotlightControl from "../delete-spotlight-control";
import { AdminNotice, adminJson, buttonClass, primaryButtonClass, SignInPrompt, StatusButton } from "../spotlight-admin";

type Row = Pick<Spotlight, "id" | "slug" | "title" | "maker_name" | "status" | "published_at" | "created_at" | "permission_confirmed">;

function formatDay(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(value)) : null;
}

export default async function AdminSpotlightsPage({ searchParams }: PageProps<"/admin/spotlights">) {
  if (!(await hasAdminSession())) return <SignInPrompt />;
  const { error } = await searchParams;
  const spotlights = await adminJson<Row[]>("spotlights?select=id,slug,title,maker_name,status,published_at,created_at,permission_confirmed&order=created_at.desc");

  return <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14">
    <header className="flex items-start justify-between gap-6 border-b border-black/10 pb-6">
      <div>
        <Link className="text-sm text-black/55 underline decoration-black/25 underline-offset-4" href="/admin">Admin</Link>
        <h1 className="mt-3 font-serif text-4xl">Spotlights</h1>
        <p className="mt-1 text-sm text-black/60">Short features on local makers. Only published spotlights appear on the site.</p>
      </div>
      <Link className={primaryButtonClass} href="/admin/spotlights/new">New spotlight</Link>
    </header>
    <AdminNotice error={typeof error === "string" ? error : undefined} />
    <section className="border border-black/10">
      {spotlights.length ? spotlights.map((spotlight) => <article key={spotlight.id} className="flex flex-col gap-3 border-b border-black/10 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link className="hover:underline" href={`/admin/spotlights/${spotlight.id}`}><h2 className="font-serif text-xl">{spotlight.title}</h2></Link>
          <p className="mt-1 text-sm text-black/60">
            {spotlight.maker_name} · <span className={`text-xs uppercase tracking-wide ${spotlight.status === "published" ? "text-green-800" : "text-black/60"}`}>{spotlight.status}</span>
            {spotlight.status === "published" && spotlight.published_at ? ` · ${formatDay(spotlight.published_at)}` : ` · created ${formatDay(spotlight.created_at)}`}
            {!spotlight.permission_confirmed ? " · permission not confirmed" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link className={buttonClass} href={`/admin/spotlights/${spotlight.id}`}>Edit</Link>
          <a className={buttonClass} href={`/spotlights/${spotlight.slug}`} target="_blank" rel="noopener noreferrer">{spotlight.status === "published" ? "View" : "Preview"}</a>
          <StatusButton id={spotlight.id} status={spotlight.status} returnTo="list" />
          <DeleteSpotlightControl action={deleteSpotlight} spotlightId={spotlight.id} title={spotlight.title} />
        </div>
      </article>) : <p className="p-6 text-sm text-black/60">No spotlights yet.</p>}
    </section>
    <p><Link className={buttonClass} href="/admin">Back to admin</Link></p>
  </main>;
}
