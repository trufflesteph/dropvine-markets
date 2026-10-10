"use client";

import { useActionState, useEffect, useRef } from "react";

import { primaryButtonClass } from "@/components/styles";
import type { ConfirmResult, UnsubscribeResult } from "@/lib/alerts/subscriptions";
import { confirmAlertsAction, unsubscribeAlertsAction } from "./actions";
import { ConfirmMessage, UnsubscribeMessage } from "./alert-messages";
import AlertStatus from "./alert-status";

// After the button's POST returns, move focus to the result heading so it's announced.
function useFocusResultHeading(result: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) ref.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [result]);
  return ref;
}

export function ConfirmAlertsForm({ token, zip, radiusMiles }: { token: string; zip: string; radiusMiles: number }) {
  const [result, action, pending] = useActionState<ConfirmResult | "error" | null, FormData>(confirmAlertsAction, null);
  const ref = useFocusResultHeading(result);
  if (result) return <div ref={ref}><ConfirmMessage result={result} /></div>;
  return (
    <AlertStatus
      heading="Confirm your market alerts."
      actions={(
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:cursor-wait disabled:opacity-80`}>
            {pending ? "Confirming…" : "Confirm my alerts"}
          </button>
        </form>
      )}
    >
      <p>You’ll get one email whenever a new market is added within {radiusMiles} miles of {zip}.</p>
      <p>Press the button to start your alerts.</p>
    </AlertStatus>
  );
}

export function UnsubscribeForm({ token, zip }: { token: string; zip: string }) {
  const [result, action, pending] = useActionState<UnsubscribeResult | "error" | null, FormData>(unsubscribeAlertsAction, null);
  const ref = useFocusResultHeading(result);
  if (result) return <div ref={ref}><UnsubscribeMessage result={result} /></div>;
  return (
    <AlertStatus
      heading="Unsubscribe from market alerts?"
      actions={(
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:cursor-wait disabled:opacity-80`}>
            {pending ? "Unsubscribing…" : "Unsubscribe"}
          </button>
        </form>
      )}
    >
      <p>You’ll stop getting emails about new markets near {zip}.</p>
    </AlertStatus>
  );
}
