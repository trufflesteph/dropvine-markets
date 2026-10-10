import type { Metadata } from "next";

import { supabaseAlertStore } from "@/lib/alerts/store-supabase";
import { type ConfirmPreview, previewConfirmation } from "@/lib/alerts/subscriptions";
import { ConfirmAlertsForm } from "../alert-link-forms";
import { ConfirmMessage } from "../alert-messages";

export const metadata: Metadata = {
  title: "Market alerts | Dropvine Markets",
  description: "Confirm your Dropvine Markets alerts.",
  robots: { index: false, follow: false },
  // Keep the token out of Referer headers if someone follows a link from this page.
  referrer: "no-referrer",
};

// Opening the link only previews; nothing changes until the button is pressed (a POST server action),
// so email link scanners and prefetchers can't confirm anyone.
export default async function ConfirmAlertsPage({ searchParams }: PageProps<"/alerts/confirm">) {
  const { token } = await searchParams;
  let preview: ConfirmPreview | { state: "error" };
  try {
    preview = await previewConfirmation(supabaseAlertStore, token, new Date());
  } catch (error) {
    console.error("[alerts] Confirmation preview failed:", error);
    preview = { state: "error" };
  }

  if (preview.state === "ready" && typeof token === "string") {
    return <ConfirmAlertsForm token={token} zip={preview.zip} radiusMiles={preview.radius_miles} />;
  }
  return <ConfirmMessage result={preview.state === "ready" ? "invalid" : preview.state} />;
}
