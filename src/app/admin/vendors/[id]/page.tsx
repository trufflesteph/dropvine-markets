import Link from "next/link";
import { notFound } from "next/navigation";

import { hasAdminSession } from "@/lib/admin-auth";
import { supabaseAdminFetch } from "@/lib/supabase-admin";
import { updateVendor, uploadVendorPhoto } from "../../actions";
import VendorEditor from "../../vendor-form";

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

async function getVendor(id: string) {
  const response = await supabaseAdminFetch(`vendors?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!response.ok) throw new Error(await response.text());
  const vendors = (await response.json()) as Vendor[];
  return vendors[0] ?? null;
}

export default async function AdminVendorPage({ params }: PageProps<"/admin/vendors/[id]">) {
  if (!(await hasAdminSession())) {
    return <main className="flex min-h-screen items-center justify-center px-6 py-16"><p>Sign in through <Link className="underline" href="/admin">admin</Link>.</p></main>;
  }

  const vendor = await getVendor((await params).id);
  if (!vendor) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14">
      <header className="flex items-start justify-between gap-6 border-b border-black/10 pb-6">
        <div>
          <Link className="text-sm text-black/55 underline decoration-black/25 underline-offset-4" href="/admin">Admin</Link>
          <h1 className="mt-3 font-serif text-4xl">Edit {vendor.business_name}</h1>
        </div>
        <Link className="border border-black/20 px-3 py-2 text-sm hover:border-black" href="/admin">Back to admin</Link>
      </header>
      <section className="max-w-3xl">
        <VendorEditor saveAction={updateVendor} uploadAction={uploadVendorPhoto} vendor={vendor} />
      </section>
    </main>
  );
}
