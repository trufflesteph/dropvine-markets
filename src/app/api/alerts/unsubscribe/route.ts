import { type NextRequest, NextResponse } from "next/server";

import { supabaseAlertStore } from "@/lib/alerts/store-supabase";
import { handleOneClickUnsubscribe } from "@/lib/alerts/subscriptions";

// List-Unsubscribe target. Mail clients' one-click button POSTs here (RFC 8058) and is unsubscribed at once.
export async function POST(request: NextRequest) {
  try {
    return await handleOneClickUnsubscribe(request, supabaseAlertStore, new Date());
  } catch (error) {
    console.error("[alerts] One-click unsubscribe failed:", error);
    return new Response("Please try again later.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

// Opening the URL (GET, and HEAD, which Next answers from GET) changes nothing: it just goes to the
// unsubscribe page, which asks for a button press.
export function GET(request: NextRequest) {
  const url = new URL("/alerts/unsubscribe", request.nextUrl.origin);
  const token = request.nextUrl.searchParams.get("token");
  if (token) url.searchParams.set("token", token);
  return NextResponse.redirect(url, 303);
}
