import type { Metadata } from "next";

import { supabaseAlertStore } from "@/lib/alerts/store-supabase";
import { previewUnsubscribe, type UnsubscribePreview } from "@/lib/alerts/subscriptions";
import { UnsubscribeForm } from "../alert-link-forms";
import { UnsubscribeMessage } from "../alert-messages";

export const metadata: Metadata = {
  title: "Unsubscribe | Dropvine Markets",
  description: "Stop Dropvine Markets alerts.",
  robots: { index: false, follow: false },
  // Keep the token out of Referer headers if someone follows a link from this page.
  referrer: "no-referrer",
};

// Opening the link only previews; the Unsubscribe button (a POST server action) makes the change, so link
// scanners can't unsubscribe anyone. Mail clients' one-click button POSTs to /api/alerts/unsubscribe instead.
export default async function UnsubscribePage({ searchParams }: PageProps<"/alerts/unsubscribe">) {
  const { token } = await searchParams;
  let preview: UnsubscribePreview | { state: "error" };
  try {
    preview = await previewUnsubscribe(supabaseAlertStore, token);
  } catch (error) {
    console.error("[alerts] Unsubscribe preview failed:", error);
    preview = { state: "error" };
  }

  if (preview.state === "ready" && typeof token === "string") return <UnsubscribeForm token={token} zip={preview.zip} />;
  return <UnsubscribeMessage result={preview.state === "ready" ? "invalid" : preview.state} />;
}
