import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /alerts/ pages carry one-time confirm and unsubscribe tokens in their URLs.
      disallow: ["/admin", "/api/", "/alerts/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
