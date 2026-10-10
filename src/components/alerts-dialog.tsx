"use client";

import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { defaultRadius, type FieldErrors, radiusOptions, type SignupField, validateSignup } from "@/lib/alerts/validation";
import { focusRingClass, primaryButtonClass } from "./styles";

const triggerSelector = '[data-alerts-open], a[href$="#alerts"]';
const fieldOrder: SignupField[] = ["email", "zip", "radius"];

const labelClass = "block text-[15px] font-medium text-navy";
const inputClass = (invalid: boolean) =>
  `mt-1.5 block min-h-11 w-full rounded-[10px] border-[1.5px] bg-white px-3 text-base text-navy outline-none focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/25 ${invalid ? "border-clay" : "border-line-strong"}`;
const errorClass = "mt-1.5 text-sm font-medium text-clay";

// Mounted once in the public layout. Opens from any [data-alerts-open] button or #alerts link, or a /#alerts URL.
export default function AlertsDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const fieldRefs = useRef<Partial<Record<SignupField, HTMLInputElement | HTMLSelectElement | null>>>({});
  const [view, setView] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const open = useCallback((trigger: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    triggerRef.current = trigger;
    setView("form");
    setErrors({});
    setFormError(null);
    setAnnouncement("");
    dialog.showModal();
    requestAnimationFrame(() => fieldRefs.current.email?.focus());
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const trigger = (event.target as Element | null)?.closest<HTMLElement>(triggerSelector);
      if (!trigger) return;
      event.preventDefault();
      open(trigger);
    }
    document.addEventListener("click", onClick);
    if (window.location.hash === "#alerts") open(null);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  useEffect(() => {
    if (view === "success") successHeadingRef.current?.focus();
  }, [view]);

  function onClose() {
    if (window.location.hash === "#alerts") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    // Return focus to whatever opened the dialog (falls back to the browser default when opened from a URL).
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus();
  }

  // showModal() already makes the page inert; this also keeps Tab from leaving the dialog for the browser chrome.
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([tabindex="-1"]), select, a[href]')]
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !event.currentTarget.contains(current) || current === successHeadingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = fieldOrder.find((field) => next[field]);
    if (first) {
      setAnnouncement(Object.values(next).join(". "));
      fieldRefs.current[first]?.focus();
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const data = new FormData(event.currentTarget);
    const raw = { email: data.get("email"), zip: data.get("zip"), radius: data.get("radius"), company: data.get("company") };
    setFormError(null);
    setAnnouncement("");

    const parsed = validateSignup(raw);
    if (!parsed.ok) return showErrors(parsed.errors);
    setErrors({});
    setSubmitting(true);
    try {
      const response = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...raw, radius: parsed.value.radius_miles }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; errors?: FieldErrors; error?: string } | null;
      if (response.ok && result?.ok) {
        setSubmittedEmail(parsed.value.email);
        setView("success");
      } else if (result?.errors) {
        showErrors(result.errors);
      } else {
        const message = result?.error ?? "Something went wrong. Please try again.";
        setFormError(message);
        setAnnouncement(message);
      }
    } catch {
      const message = "We couldn't reach the server. Check your connection and try again.";
      setFormError(message);
      setAnnouncement(message);
    } finally {
      setSubmitting(false);
    }
  }

  const describedBy = (field: SignupField, extra?: string) => [errors[field] ? `alerts-${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={view === "form" ? "alerts-title" : "alerts-success-title"}
      aria-describedby={view === "form" ? "alerts-description" : "alerts-success-description"}
      onClose={onClose}
      onKeyDown={trapFocus}
      onClick={(event) => { if (event.target === dialogRef.current) close(); }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[460px] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-navy shadow-[0_24px_60px_-20px_rgba(29,52,97,0.45)] backdrop:bg-navy/45"
    >
      <div className="relative px-6 pt-7 pb-6 sm:px-8 sm:pt-8 sm:pb-7">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full text-2xl leading-none text-navy hover:bg-cream ${focusRingClass}`}
        >
          <span aria-hidden="true">×</span>
        </button>

        <p className="sr-only" aria-live="assertive">{announcement}</p>

        {view === "form" ? (
          <>
            <h2 id="alerts-title" className="pr-8 font-serif text-[30px] leading-[1.05] font-medium">Never miss a market near you.</h2>
            <p id="alerts-description" className="mt-3 text-base leading-normal text-ink-muted">
              Tell us where you shop and we’ll email you when a new market is added near you. No account needed.
            </p>

            <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="alerts-email" className={labelClass}>Email</label>
                <input
                  ref={(element) => { fieldRefs.current.email = element; }}
                  id="alerts-email" name="email" type="email" autoComplete="email" inputMode="email" required
                  aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")}
                  className={inputClass(Boolean(errors.email))}
                />
                {errors.email ? <p id="alerts-email-error" className={errorClass}>{errors.email}</p> : null}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <div>
                  <label htmlFor="alerts-zip" className={labelClass}>ZIP code</label>
                  <input
                    ref={(element) => { fieldRefs.current.zip = element; }}
                    id="alerts-zip" name="zip" type="text" autoComplete="postal-code" inputMode="numeric" maxLength={10} required
                    aria-invalid={Boolean(errors.zip)} aria-describedby={describedBy("zip")}
                    className={inputClass(Boolean(errors.zip))}
                  />
                </div>
                <div>
                  <label htmlFor="alerts-radius" className={labelClass}>Within</label>
                  <select
                    ref={(element) => { fieldRefs.current.radius = element; }}
                    id="alerts-radius" name="radius" defaultValue={defaultRadius}
                    aria-invalid={Boolean(errors.radius)} aria-describedby={describedBy("radius")}
                    className={inputClass(Boolean(errors.radius))}
                  >
                    {radiusOptions.map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}
                  </select>
                </div>
              </div>
              {/* Errors for the side-by-side fields sit below the row so long messages don't squeeze the inputs. */}
              {errors.zip ? <p id="alerts-zip-error" className={`${errorClass} -mt-2`}>{errors.zip}</p> : null}
              {errors.radius ? <p id="alerts-radius-error" className={`${errorClass} -mt-2`}>{errors.radius}</p> : null}

              {/* Honeypot: hidden from people and assistive tech; bots that fill every field get a silent no-op. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="alerts-company">Company</label>
                <input id="alerts-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              {formError ? <p role="alert" className={errorClass}>{formError}</p> : null}

              <div className="pt-1">
                <button type="submit" disabled={submitting} className={`${primaryButtonClass} sm:w-full disabled:cursor-wait disabled:opacity-80`}>
                  {submitting ? "Sending…" : "Notify me"}
                </button>
                <p className="mt-3 text-center text-sm text-ink-muted">One email per new market. Unsubscribe anytime.</p>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 id="alerts-success-title" ref={successHeadingRef} tabIndex={-1} className="pr-8 font-serif text-[30px] leading-[1.05] font-medium outline-none">
              Check your email.
            </h2>
            <p id="alerts-success-description" className="mt-3 text-base leading-normal text-ink-muted">
              We sent a confirmation link to <strong className="font-bold break-words text-navy">{submittedEmail}</strong>. Your alerts start once you click it.
            </p>
            <button type="button" onClick={close} className={`mt-6 ${primaryButtonClass} sm:w-full`}>Done</button>
          </>
        )}
      </div>
    </dialog>
  );
}
