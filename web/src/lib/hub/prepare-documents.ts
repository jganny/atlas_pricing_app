/**
 * Turns dropped files into the documents the AI reads. Each Outlook email (with the files inside it)
 * is one job; every other file dropped together is one more job.
 */
import { emailAsText, isEmailFileName, parseEmailFile, type EmailAttachment } from "./email-file";
import type { HubDocument } from "./types";

export interface PreparedJob {
  label: string;
  documents: HubDocument[];
  headerSender?: { name: string; email: string };
  fileNames: string[];
}

const MAX_TOTAL_BASE64 = 8.5 * 1024 * 1024;
const MIN_IMAGE_BYTES = 15 * 1024; // smaller images are almost always signature logos

type RawFile = { name: string; mime: string; bytes: Uint8Array };

const ext = (name: string) => (name.lastIndexOf(".") >= 0 ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function shrinkImage(bytes: Uint8Array, mime: string): Promise<{ data: string; mime: string }> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return { data: toBase64(bytes), mime };
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.82);
    return { data: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
  } catch {
    return { data: toBase64(bytes), mime };
  }
}

async function excelText(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 5)) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet).split("\n").slice(0, 400).join("\n");
    parts.push(`Sheet: ${name}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function wordText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return (await mammoth.extractRawText({ arrayBuffer: ab })).value;
}

/** One file → a document the AI can read, or null when it is not something worth reading. */
export async function documentFromFile(f: RawFile): Promise<HubDocument | null> {
  const e = ext(f.name);
  if (e === "pdf" || f.mime === "application/pdf") return { name: f.name, kind: "pdf", mime: "application/pdf", data: toBase64(f.bytes) };
  if (/^(png|jpe?g|webp|gif|heic)$/.test(e) || f.mime.startsWith("image/")) {
    if (f.bytes.length < MIN_IMAGE_BYTES) return null;
    const img = await shrinkImage(f.bytes, f.mime.startsWith("image/") ? f.mime : "image/jpeg");
    return { name: f.name, kind: "image", mime: img.mime, data: img.data };
  }
  if (e === "xlsx" || e === "xls" || e === "csv") {
    const text = await excelText(f.bytes);
    return text.trim() ? { name: f.name, kind: "text", text } : null;
  }
  if (e === "docx") {
    const text = await wordText(f.bytes);
    return text.trim() ? { name: f.name, kind: "text", text } : null;
  }
  if (e === "txt" || e === "md" || f.mime.startsWith("text/")) {
    const text = new TextDecoder().decode(f.bytes);
    return text.trim() ? { name: f.name, kind: "text", text } : null;
  }
  return null; // calendar invites, vcards, zips… are skipped
}

function checkSize(docs: HubDocument[]) {
  const total = docs.reduce((n, d) => n + (d.kind === "text" ? 0 : d.data.length), 0);
  if (total > MAX_TOTAL_BASE64) {
    throw new Error("These files are too large to read together. Try fewer or smaller files, or drop them in two goes.");
  }
}

async function rawFile(file: File): Promise<RawFile> {
  return { name: file.name, mime: file.type || "", bytes: new Uint8Array(await file.arrayBuffer()) };
}

async function documentsFrom(files: RawFile[]): Promise<HubDocument[]> {
  const out: HubDocument[] = [];
  for (const f of files) {
    const d = await documentFromFile(f);
    if (d) out.push(d);
  }
  return out;
}

export async function prepareEmail(name: string, bytes: Uint8Array): Promise<PreparedJob> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const mail = await parseEmailFile(name, ab);
  const attachments: EmailAttachment[] = mail.attachments;
  const docs: HubDocument[] = [{ name, kind: "text", text: emailAsText(mail) }, ...(await documentsFrom(attachments))];
  checkSize(docs);
  return {
    label: mail.subject || name,
    documents: docs,
    headerSender: mail.fromEmail ? { name: mail.fromName, email: mail.fromEmail } : undefined,
    fileNames: [name, ...attachments.map((a) => a.name)],
  };
}

/** All the dropped files → the jobs to read (each email on its own; everything else together). */
export async function prepareJobs(files: File[]): Promise<PreparedJob[]> {
  const jobs: PreparedJob[] = [];
  const loose: RawFile[] = [];
  for (const file of files) {
    const raw = await rawFile(file);
    if (isEmailFileName(file.name)) {
      try {
        jobs.push(await prepareEmail(file.name, raw.bytes));
      } catch (e) {
        throw new Error(`Could not open "${file.name}"${e instanceof Error ? ` (${e.message})` : ""}.`);
      }
    } else loose.push(raw);
  }
  if (loose.length) {
    const docs = await documentsFrom(loose);
    if (!docs.length) throw new Error("Nothing readable in those files. Use PDF, Excel, Word, images, text or Outlook emails.");
    checkSize(docs);
    jobs.push({ label: loose.length === 1 ? loose[0].name : `${loose.length} documents`, documents: docs, fileNames: loose.map((f) => f.name) });
  }
  return jobs;
}
