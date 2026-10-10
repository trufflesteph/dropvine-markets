"use client";

import { useState } from "react";

import SubmitButton from "./submit-button";

type Props = { marketId: string; recipientCount: number; action: (formData: FormData) => Promise<void> };

// Two steps on purpose: "Send alerts" only asks; the emails go out on the explicit "Yes, send" click.
export default function SendAlertsControl({ marketId, recipientCount, action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const label = `${recipientCount} ${recipientCount === 1 ? "subscriber" : "subscribers"}`;

  if (!recipientCount) return <button className="mt-4 border border-black/20 px-3 py-2 text-sm text-black/40" disabled type="button">No one to email yet</button>;

  if (!confirming) {
    return <button className="mt-4 bg-black px-3 py-2 text-sm text-white" onClick={() => setConfirming(true)} type="button">Send alerts</button>;
  }

  return (
    <form action={action} className="mt-4 border border-amber-700/30 bg-amber-50 p-4">
      <input name="market_id" type="hidden" value={marketId} />
      <input name="confirm" type="hidden" value="yes" />
      <p className="text-sm text-amber-950">Email {label} about this market now? This can’t be undone.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <SubmitButton className="bg-black px-3 py-2 text-sm text-white" pendingLabel="Sending…">Yes, send {recipientCount} {recipientCount === 1 ? "email" : "emails"}</SubmitButton>
        <button className="border border-black/20 px-3 py-2 text-sm hover:border-black" onClick={() => setConfirming(false)} type="button">Cancel</button>
      </div>
    </form>
  );
}
