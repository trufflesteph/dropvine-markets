import { type ConfirmResult, confirmationValidDays, type UnsubscribeResult } from "@/lib/alerts/subscriptions";
import AlertStatus from "./alert-status";

// The same wording whether a result comes from opening the link (GET) or pressing the button (POST).
// None of these show the subscriber's email address.

export function ConfirmMessage({ result }: { result: ConfirmResult | "error" }) {
  switch (result) {
    case "confirmed":
      return (
        <AlertStatus heading="You’re on the list.">
          <p>Your market alerts are confirmed. When a new market is added within your radius, we’ll send you one email about it.</p>
          <p>Every alert has an unsubscribe link, so you can stop anytime.</p>
        </AlertStatus>
      );
    case "already-confirmed":
      return (
        <AlertStatus heading="You’re already on the list.">
          <p>This link was already used, and your market alerts are active. There’s nothing else to do.</p>
        </AlertStatus>
      );
    case "expired":
      return (
        <AlertStatus heading="This link has expired." signUpAgain>
          <p>Confirmation links work for {confirmationValidDays} days. Sign up again and we’ll send you a fresh one.</p>
        </AlertStatus>
      );
    case "unsubscribed":
      return (
        <AlertStatus heading="This link is no longer active." signUpAgain>
          <p>You unsubscribed from these alerts after this link was sent. To start them again, sign up once more.</p>
        </AlertStatus>
      );
    case "invalid":
      return (
        <AlertStatus heading="We couldn’t find that link." signUpAgain>
          <p>The confirmation link may be incomplete. Try opening it straight from the email, or sign up again for a new one.</p>
        </AlertStatus>
      );
    default:
      return (
        <AlertStatus heading="Something went wrong.">
          <p>We couldn’t confirm your alerts just now. Please try the link again in a few minutes.</p>
        </AlertStatus>
      );
  }
}

export function UnsubscribeMessage({ result }: { result: UnsubscribeResult | "error" }) {
  switch (result) {
    case "unsubscribed":
      return (
        <AlertStatus heading="You’re unsubscribed." signUpAgain>
          <p>You won’t get any more market alerts for this ZIP code. Changed your mind? You can sign up again anytime.</p>
        </AlertStatus>
      );
    case "already-unsubscribed":
      return (
        <AlertStatus heading="You’re already unsubscribed." signUpAgain>
          <p>We won’t send you any more market alerts for this ZIP code.</p>
        </AlertStatus>
      );
    case "invalid":
      return (
        <AlertStatus heading="We couldn’t find that link.">
          <p>The unsubscribe link may be incomplete. Try opening it straight from the email. If you keep getting alerts you don’t want, email <a className="font-bold text-clay hover:text-clay-dark" href="mailto:hello@dropvine.pro?subject=Unsubscribe%20from%20market%20alerts">hello@dropvine.pro</a> and we’ll remove you.</p>
        </AlertStatus>
      );
    default:
      return (
        <AlertStatus heading="Something went wrong.">
          <p>We couldn’t unsubscribe you just now. Please try the link again in a few minutes.</p>
        </AlertStatus>
      );
  }
}
