"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return <button type="button" onClick={() => router.back()} className="mb-8 inline-flex items-center gap-2 border border-black/20 px-3 py-2 text-sm transition-colors hover:border-black" aria-label="Go back">
    <span aria-hidden="true" className="text-lg leading-none">&#8592;</span>
    <span>Back</span>
  </button>;
}
