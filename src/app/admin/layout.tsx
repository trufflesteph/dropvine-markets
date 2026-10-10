import type { Metadata } from "next";

// Applies to every /admin page: keep them out of search results.
export const metadata: Metadata = {
  title: "Admin | Dropvine Markets",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
