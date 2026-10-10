"use server";

import { supabaseAlertStore } from "@/lib/alerts/store-supabase";
import { type ConfirmResult, confirmSubscription, unsubscribe, type UnsubscribeResult } from "@/lib/alerts/subscriptions";

// Server actions only run on POST (with Next's origin check), so opening an email link, a HEAD request,
// or a prefetch can never reach these.

export async function confirmAlertsAction(_previous: ConfirmResult | "error" | null, formData: FormData): Promise<ConfirmResult | "error"> {
  try {
    return await confirmSubscription(supabaseAlertStore, formData.get("token"), new Date());
  } catch (error) {
    console.error("[alerts] Confirmation failed:", error);
    return "error";
  }
}

export async function unsubscribeAlertsAction(_previous: UnsubscribeResult | "error" | null, formData: FormData): Promise<UnsubscribeResult | "error"> {
  try {
    return await unsubscribe(supabaseAlertStore, formData.get("token"), new Date());
  } catch (error) {
    console.error("[alerts] Unsubscribe failed:", error);
    return "error";
  }
}
