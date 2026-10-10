import type { AlertsConfig, EmailMessage } from "./types.ts";

// Simple, mostly table-free HTML with inline styles and email-safe fonts, plus a plain-text version.
const colors = { cream: "#FBF6EE", navy: "#1D3461", green: "#2F5128", muted: "#5E544A", line: "#EADFCC" };
const serif = "Georgia, 'Times New Roman', serif";
const sans = "Helvetica, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function unsubscribePageUrl(config: AlertsConfig, token: string) {
  return `${config.siteUrl}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

// RFC 8058 one-click endpoint: mail clients POST here when the reader uses their built-in "Unsubscribe".
export function oneClickUnsubscribeUrl(config: AlertsConfig, token: string) {
  return `${config.siteUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

function unsubscribeHeaders(config: AlertsConfig, token: string) {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(config, token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function mailingAddressLine(config: AlertsConfig) {
  return config.mailingAddress ? `Dropvine Markets · ${config.mailingAddress}` : "Dropvine Markets · [Mailing address: set ALERTS_MAILING_ADDRESS]";
}

function layout({ heading, body, button, footer }: { heading: string; body: string; button: { href: string; label: string }; footer: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:${colors.cream};">
<div style="background:${colors.cream};padding:32px 16px;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid ${colors.line};border-radius:16px;padding:32px 28px;">
<p style="margin:0 0 20px;font-family:${serif};font-size:20px;font-weight:bold;color:${colors.navy};">Dropvine <span style="color:${colors.green};">Markets</span></p>
<h1 style="margin:0 0 16px;font-family:${serif};font-size:28px;line-height:1.15;font-weight:normal;color:${colors.navy};">${heading}</h1>
${body}
<p style="margin:28px 0;"><a href="${button.href}" style="display:inline-block;background:${colors.navy};color:#ffffff;font-family:${sans};font-size:16px;font-weight:bold;text-decoration:none;padding:14px 24px;border-radius:10px;">${button.label}</a></p>
<p style="margin:0;font-family:${sans};font-size:13px;line-height:1.5;color:${colors.muted};">If the button doesn't work, copy this link into your browser:<br><a href="${button.href}" style="color:${colors.navy};word-break:break-all;">${button.href}</a></p>
</div>
<div style="max-width:520px;margin:0 auto;padding:20px 28px 0;font-family:${sans};font-size:12px;line-height:1.6;color:${colors.muted};">${footer}</div>
</div>
</body></html>`;
}

const paragraph = (html: string) => `<p style="margin:0 0 12px;font-family:${sans};font-size:16px;line-height:1.55;color:${colors.navy};">${html}</p>`;

export function confirmationEmail(
  config: AlertsConfig,
  subscriber: { email: string; zip: string; radius_miles: number; confirm_token: string; unsubscribe_token: string },
): EmailMessage {
  const confirmUrl = `${config.siteUrl}/alerts/confirm?token=${encodeURIComponent(subscriber.confirm_token)}`;
  const unsubscribeUrl = unsubscribePageUrl(config, subscriber.unsubscribe_token);
  const what = `email alerts when a new market is added within ${subscriber.radius_miles} miles of ${subscriber.zip}`;
  const ignore = "If this wasn't you, you can ignore this email and you won't hear from us.";
  return {
    to: subscriber.email,
    subject: "Confirm your Dropvine Markets alerts",
    headers: unsubscribeHeaders(config, subscriber.unsubscribe_token),
    html: layout({
      heading: "Confirm your market alerts",
      body: paragraph(`You asked for ${escapeHtml(what)}. Confirm below and we'll start watching for you.`) + paragraph(escapeHtml(ignore)),
      button: { href: confirmUrl, label: "Confirm my alerts" },
      footer: `${escapeHtml(mailingAddressLine(config))}<br><a href="${unsubscribeUrl}" style="color:${colors.muted};">Unsubscribe</a>`,
    }),
    text: [
      "Confirm your market alerts",
      "",
      `You asked for ${what}. Confirm here and we'll start watching for you:`,
      confirmUrl,
      "",
      ignore,
      "",
      "--",
      mailingAddressLine(config),
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
  };
}

export type AlertMarket = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  dates: string | null;
  vendorCount: number;
};

export function newMarketEmail(
  config: AlertsConfig,
  market: AlertMarket,
  subscriber: { id: string; email: string; zip: string; unsubscribe_token: string },
): EmailMessage {
  const marketUrl = `${config.siteUrl}/markets/${encodeURIComponent(market.slug)}`;
  const unsubscribeUrl = unsubscribePageUrl(config, subscriber.unsubscribe_token);
  const details = [market.dates, `${market.city}, ${market.state}`, market.vendorCount ? `${market.vendorCount} ${market.vendorCount === 1 ? "vendor" : "vendors"}` : null]
    .filter(Boolean)
    .join(" · ");
  const reason = `You're receiving this because you asked for market alerts near ${subscriber.zip}.`;
  return {
    to: subscriber.email,
    subject: `New market near you: ${market.name}`,
    headers: unsubscribeHeaders(config, subscriber.unsubscribe_token),
    idempotencyKey: `market-alert/${market.id}/${subscriber.id}`,
    html: layout({
      heading: escapeHtml(market.name),
      body: paragraph("A new market was just added near you.") + paragraph(`<strong>${escapeHtml(details)}</strong>`),
      button: { href: marketUrl, label: "See the market" },
      footer: `${escapeHtml(reason)}<br><a href="${unsubscribeUrl}" style="color:${colors.muted};">Unsubscribe</a><br>${escapeHtml(mailingAddressLine(config))}`,
    }),
    text: [
      market.name,
      "",
      "A new market was just added near you.",
      details,
      "",
      `See the market: ${marketUrl}`,
      "",
      "--",
      reason,
      `Unsubscribe: ${unsubscribeUrl}`,
      mailingAddressLine(config),
    ].join("\n"),
  };
}
