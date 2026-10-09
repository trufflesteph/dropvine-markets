"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { focusRingClass } from "./styles";

const links = [
  { href: "/about", label: "About" },
  { href: "https://dropvine.pro", label: "For makers" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-8 sm:flex">
      {links.map((link) => {
        const current = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 items-center text-base text-navy no-underline ${current ? "font-bold" : "font-medium"} ${focusRingClass}`}
          >
            <span className={current ? "border-b-2 border-navy pb-0.5" : "border-b-2 border-transparent pb-0.5"}>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
