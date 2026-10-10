import Link from "next/link";
import type { ReactNode } from "react";

import { focusRingClass, primaryButtonClass } from "@/components/styles";

// Shared layout for the confirm and unsubscribe pages. `actions` replaces the default links (used for the
// confirm/unsubscribe button); the heading can take focus so screen readers announce a new result.
export default function AlertStatus({ heading, children, signUpAgain = false, actions }: { heading: string; children: ReactNode; signUpAgain?: boolean; actions?: ReactNode }) {
  return (
    <main className="bg-cream px-5 py-16 sm:px-10 sm:py-24 lg:px-[72px]">
      <div className="mx-auto max-w-[640px]">
        <h1 tabIndex={-1} className="font-serif text-[44px] leading-[1.02] font-medium tracking-[-0.018em] text-navy outline-none sm:text-[60px]">{heading}</h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-navy">{children}</div>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          {actions ?? (
            <>
              <Link href="/" className={primaryButtonClass}>Browse upcoming markets</Link>
              {signUpAgain ? (
                <button type="button" data-alerts-open className={`inline-flex min-h-11 items-center justify-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
                  Sign up for alerts
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
