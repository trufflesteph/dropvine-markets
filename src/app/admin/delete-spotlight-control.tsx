"use client";

import { useState } from "react";

import SubmitButton from "./submit-button";

type Props = { spotlightId: string; title: string; action: (formData: FormData) => Promise<void> };

// Two steps, like sending alerts: "Delete" only asks; the spotlight and its images go on "Yes, delete".
export default function DeleteSpotlightControl({ spotlightId, title, action }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) return <button className="text-sm text-red-700" onClick={() => setConfirming(true)} type="button">Delete</button>;

  return (
    <form action={action} className="border border-red-700/30 bg-red-50 p-3">
      <input name="id" type="hidden" value={spotlightId} />
      <input name="confirm" type="hidden" value="yes" />
      <p className="text-sm text-red-900">Delete “{title}” and its images? This can’t be undone.</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <SubmitButton className="bg-red-700 px-3 py-2 text-sm text-white" pendingLabel="Deleting…">Yes, delete</SubmitButton>
        <button className="border border-black/20 px-3 py-2 text-sm hover:border-black" onClick={() => setConfirming(false)} type="button">Cancel</button>
      </div>
    </form>
  );
}
