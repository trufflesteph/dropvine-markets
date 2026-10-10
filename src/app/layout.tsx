import type { Metadata } from "next";
import { DM_Sans, EB_Garamond } from "next/font/google";
import Script from "next/script";

import { defaultShareImage } from "@/lib/image-url";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Dropvine Markets",
  description: "Find local markets worth wandering through.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "Dropvine Markets",
    title: "Dropvine Markets",
    description: "Find local markets worth wandering through.",
    images: [defaultShareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultShareImage],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
            <Script id="google-analytics">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
