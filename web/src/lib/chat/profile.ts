/** A person's chat profile: an optional small photo and a one-line work status. Nothing else — no stories, no bio. */

export interface ChatProfile {
  login: string;
  /** A small JPEG as a data address (about 96 pixels square). */
  photo?: string;
  /** One line: "Available", "In a meeting", … or a short sentence of their own. */
  status?: string;
  statusAt?: number;
}

export const PHOTO_SIZE = 96;
/** A 96-pixel JPEG is normally 4–8 KB (about 10 K characters as text). Anything bigger is rejected, not stored. */
export const MAX_PHOTO_CHARS = 24_000;
export const MAX_STATUS_CHARS = 60;

export const STATUS_PRESETS = ["Available", "In a meeting", "Travelling", "At the airport", "On leave", "Do not disturb"] as const;

/** Trimmed, single-line, capped. Empty means "no status". */
export function cleanStatus(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_STATUS_CHARS);
}

/** Biggest size that fits inside `max` on the longer side, keeping the shape (never enlarges). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function isAcceptablePhoto(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/jpeg;base64,") && dataUrl.length <= MAX_PHOTO_CHARS;
}

/** Centre-crops a chosen picture to a square and shrinks it. Runs in the browser (needs canvas). */
export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture (JPEG or PNG).");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare the picture.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close?.();
  for (const quality of [0.8, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (isAcceptablePhoto(url)) return url;
  }
  throw new Error("That picture is too detailed to shrink. Try another.");
}
