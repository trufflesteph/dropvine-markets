import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Dropvine Markets",
  description: "Find local markets worth wandering through.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dropvinemarkets.com"),
  openGraph: {
    type: "website",
    siteName: "Dropvine Markets",
    title: "Dropvine Markets",
    description: "Find local markets worth wandering through.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <div className="flex-1">{children}</div>
        <footer className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-2 border-t border-black/10 pt-5 text-sm text-black/50 sm:flex-row sm:items-center sm:justify-between">
            <span>Dropvine Markets</span>
          </div>
        </footer>
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
