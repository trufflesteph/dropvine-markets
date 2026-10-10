import { Resend } from "resend";

import type { Mailer } from "./types.ts";

export function createResendMailer(apiKey: string, from: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send(message) {
      const { error } = await resend.emails.send(
        { from, to: message.to, subject: message.subject, html: message.html, text: message.text, headers: message.headers },
        message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
      );
      return error ? { ok: false, error: `${error.name}: ${error.message}` } : { ok: true };
    },
  };
}
