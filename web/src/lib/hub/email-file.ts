/**
 * Reads an email dragged out of Outlook: `.msg` (desktop Outlook) or `.eml` (Outlook on the web and
 * most other mail programs). Gives back who sent it, what it says, and the files attached to it.
 */
import PostalMime from "postal-mime";

export interface EmailAttachment {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ParsedEmail {
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string;
  bodyText: string;
  attachments: EmailAttachment[];
}

export function isEmailFileName(name: string): boolean {
  return /\.(eml|msg)$/i.test(name);
}

/** Plain text from HTML mail when there is no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function bytesOf(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof content === "string") return new TextEncoder().encode(content);
  return new Uint8Array();
}

export async function parseEml(data: ArrayBuffer | Uint8Array): Promise<ParsedEmail> {
  const mail = await PostalMime.parse(data as ArrayBuffer);
  const body = (mail.text && mail.text.trim()) || (mail.html ? htmlToText(mail.html) : "");
  return {
    subject: mail.subject || "",
    fromName: mail.from?.name || "",
    fromEmail: (mail.from?.address || "").toLowerCase(),
    date: mail.date || "",
    bodyText: body,
    attachments: (mail.attachments || [])
      .filter((a) => !a.related || (a.filename && !/^image\d*\.(png|jpe?g|gif)$/i.test(a.filename)))
      .map((a, i) => ({
        name: a.filename || `attachment-${i + 1}`,
        mime: a.mimeType || "application/octet-stream",
        bytes: bytesOf(a.content),
      })),
  };
}

/** An address in an Exchange-internal form (/O=...) is no use — the sender header text is better. */
function senderFromHeaders(headers: string | undefined): { name: string; email: string } | null {
  if (!headers) return null;
  const m = /^From:\s*(?:"?([^"<\r\n]*?)"?\s*)?<?([^\s<>@]+@[^\s<>]+)>?/im.exec(headers);
  return m ? { name: (m[1] || "").trim(), email: m[2].toLowerCase() } : null;
}

export async function parseMsg(data: ArrayBuffer): Promise<ParsedEmail> {
  const { default: MsgReader } = await import("@kenjiuno/msgreader");
  const reader = new MsgReader(data);
  const f = reader.getFileData();
  if ((f as { error?: string }).error) throw new Error((f as { error?: string }).error);
  const fromHeader = senderFromHeaders(f.headers);
  const smtp = f.senderSmtpAddress || (f.senderEmail && f.senderEmail.includes("@") ? f.senderEmail : "");
  const body = (f.body && f.body.trim()) || (f.bodyHtml ? htmlToText(f.bodyHtml) : "");
  const attachments: EmailAttachment[] = [];
  for (const att of f.attachments || []) {
    if (att.innerMsgContent) continue; // nested emails are not unpacked
    try {
      const got = reader.getAttachment(att);
      attachments.push({
        name: got.fileName || att.fileName || "attachment",
        mime: att.attachMimeTag || "application/octet-stream",
        bytes: got.content,
      });
    } catch {
      /* an unreadable attachment shouldn't lose the rest of the email */
    }
  }
  return {
    subject: f.subject || "",
    fromName: f.senderName || fromHeader?.name || "",
    fromEmail: (smtp || fromHeader?.email || "").toLowerCase(),
    date: "",
    bodyText: body,
    attachments,
  };
}

export async function parseEmailFile(name: string, data: ArrayBuffer): Promise<ParsedEmail> {
  if (/\.msg$/i.test(name)) return parseMsg(data);
  return parseEml(data);
}

/** How the email goes to the AI: who it is from, the subject and the message. */
export function emailAsText(mail: ParsedEmail): string {
  return [
    "EMAIL",
    `From: ${mail.fromName ? `${mail.fromName} ` : ""}<${mail.fromEmail || "unknown"}>`,
    mail.date ? `Date: ${mail.date}` : "",
    `Subject: ${mail.subject}`,
    "",
    mail.bodyText,
  ]
    .filter((l, i) => l !== "" || i >= 3)
    .join("\n");
}
