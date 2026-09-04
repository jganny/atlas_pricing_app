/** SMS outbox + optional webhook / device sms: deep-link (legacy triggerSmsGateway). */

const OUTBOX_KEY = "atlas_sms_outbox";
const WEBHOOK_KEY = "atlas_sms_webhook";

export type SmsOutboxEntry = {
  to: string;
  body: string;
  at: number;
  by?: string;
  via: "device" | "webhook" | "queued";
};

export function listSmsOutbox(): SmsOutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getSmsWebhook(): string {
  try {
    return localStorage.getItem(WEBHOOK_KEY) || "";
  } catch {
    return "";
  }
}

export function setSmsWebhook(url: string) {
  if (url.trim()) localStorage.setItem(WEBHOOK_KEY, url.trim());
  else localStorage.removeItem(WEBHOOK_KEY);
}

export async function sendSms(input: {
  to: string;
  body: string;
  by?: string;
}): Promise<SmsOutboxEntry> {
  const webhook = getSmsWebhook();
  let via: SmsOutboxEntry["via"] = "queued";
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: input.to, body: input.body, by: input.by }),
      });
      via = "webhook";
    } catch {
      via = "queued";
    }
  } else if (typeof window !== "undefined") {
    const href = `sms:${encodeURIComponent(input.to)}?body=${encodeURIComponent(input.body)}`;
    window.open(href, "_self");
    via = "device";
  }
  const entry: SmsOutboxEntry = {
    to: input.to,
    body: input.body,
    at: Date.now(),
    by: input.by,
    via,
  };
  const next = [entry, ...listSmsOutbox()].slice(0, 40);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
  return entry;
}
