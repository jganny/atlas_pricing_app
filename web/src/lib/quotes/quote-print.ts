/** Isolated print/download so Enquiry DB chrome is never laid out for PDF. */

export function downloadTextFile(filename: string, content: string, mime = "text/html;charset=utf-8"): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-testid", "quote-print-frame");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:830px;height:1100px;border:0;background:#fff;";

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.setTimeout(() => iframe.remove(), 400);
      resolve();
    };

    let printed = false;
    iframe.addEventListener("load", () => {
      if (printed || finished) return;
      printed = true;
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        reject(new Error("Print frame failed to open"));
        return;
      }
      win.onafterprint = done;
      try {
        win.focus();
        win.print();
      } catch (err) {
        iframe.remove();
        reject(err);
      }
    });

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      if (printed || finished) return;
      const win = iframe.contentWindow;
      if (!win) return;
      printed = true;
      win.onafterprint = done;
      try {
        win.focus();
        win.print();
      } catch {
        done();
      }
    }, 700);
    window.setTimeout(done, 120_000);
  });
}

export function openMailTo(subject: string, body = ""): void {
  const url = `mailto:?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
  window.location.href = url;
}

export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(text: string): void {
  const url = whatsAppShareUrl(text);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

/**
 * WhatsApp has no URL scheme that pre-attaches a file (unlike the .eml trick
 * used for email) — the only way a web page can hand WhatsApp a file directly
 * is the OS share sheet via the Web Share API, and only on devices/browsers
 * that support sharing files (mostly mobile). Where that works, the user
 * picks WhatsApp from the share sheet with the PDF already attached and the
 * message text pre-filled. Where it doesn't (most desktop browsers, and
 * WhatsApp Desktop itself has no drop target a page can reach), this falls
 * back to opening the chat with the text pre-filled and downloading the PDF
 * for the user to attach by hand — there's no further workaround for that
 * case.
 */
export async function shareQuoteViaWhatsApp(opts: {
  file: File;
  text: string;
  title: string;
}): Promise<"shared" | "fallback"> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    const payload: ShareData = { files: [opts.file], text: opts.text, title: opts.title };
    try {
      if (nav.canShare({ files: payload.files })) {
        await nav.share(payload);
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      // Share sheet exists but failed for another reason — fall through to the chat-link path.
    }
  }
  openWhatsApp(opts.text);
  return "fallback";
}

function htmlForPdfCapture(html: string): string {
  const css = "<style>html,body.pdf-pack{height:auto!important;min-height:0!important;}</style>";
  return html
    .replace(/ hidden(="")?/g, "")
    .replace("</head>", `${css}</head>`)
    .replace("<body>", '<body class="pdf-pack">')
    .replace("<body ", '<body class="pdf-pack" ');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function foldBase64(value: string): string {
  return value.replace(/(.{76})/g, "$1\n").trim();
}

/** RFC822 draft so Mail / Outlook open with the PDF already attached. */
export function buildQuoteEmailDraft(opts: {
  subject: string;
  body: string;
  filename: string;
  pdfBytes: Uint8Array;
}): string {
  const boundary = "----=_VertexQuotePdf";
  const safeName = opts.filename.replace(/["\r\n]/g, "_");
  const b64 = foldBase64(bytesToBase64(opts.pdfBytes));
  return [
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Subject: ${opts.subject.replace(/[\r\n]+/g, " ")}`,
    "To: ",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.body ?? "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeName}"`,
    "",
    b64,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export function usablePdfPageHeight(pageHeight: number, margin: number): number {
  return Math.max(1, pageHeight - margin * 2);
}

/** How many A4 pages the captured image needs after margins. */
export function pdfPageCount(imgHeight: number, pageHeight: number, margin: number): number {
  const usable = usablePdfPageHeight(pageHeight, margin);
  if (imgHeight <= usable + 0.75) return 1;
  return Math.ceil(imgHeight / usable);
}

/** Bottom-most row that is not paper-white. Used to drop a blank trailing page. */
export function lastInkRow(data: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y--) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return y;
    }
  }
  return 0;
}

export function trimmedCaptureHeight(inkBottom: number, height: number, pad = 16): number {
  return Math.min(height, Math.max(1, inkBottom + pad));
}

function cropCanvasBottom(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const nextH = trimmedCaptureHeight(lastInkRow(image.data, width, height), height);
  if (nextH >= height - 1) return canvas;
  const next = document.createElement("canvas");
  next.width = width;
  next.height = nextH;
  const nctx = next.getContext("2d");
  if (!nctx) return canvas;
  nctx.drawImage(canvas, 0, 0);
  return next;
}

const PDF_CAPTURE_WIDTH = 720;
const PDF_CAPTURE_SCALE = 2;
const PDF_MARGIN = 36;

/**
 * The PDF is one tall html2canvas screenshot sliced into A4-sized pages by
 * jsPDF (see below) — a raster crop, not a real print layout, so CSS rules
 * like `.panel { break-inside: avoid }` have no effect on it. Without this,
 * a card that happens to straddle a slice boundary gets cut on one page and
 * then the same rows repeat at the top of the next, because each page
 * re-draws the same source image at a shifted offset. This walks every
 * `.panel` in capture order and, where one would straddle a boundary,
 * inserts a spacer before it so it starts cleanly on the next page instead
 * — the same effect `break-inside: avoid` gives a real printed page, just
 * done by hand since the raster capture can't see that CSS rule.
 */
function insertPageBreakSpacers(doc: Document, usableCanvasPx: number) {
  if (!(usableCanvasPx > 0)) return;
  let shift = 0;
  const panels = Array.from(doc.querySelectorAll<HTMLElement>(".panel"));
  for (const panel of panels) {
    const top = panel.offsetTop + shift;
    const bottom = top + panel.offsetHeight;
    const pageOfTop = Math.floor(top / usableCanvasPx);
    const pageOfBottom = Math.floor((bottom - 1) / usableCanvasPx);
    if (panel.offsetHeight >= usableCanvasPx || pageOfTop === pageOfBottom) continue;
    const nextPageTop = (pageOfTop + 1) * usableCanvasPx;
    const gap = nextPageTop - top;
    const spacer = doc.createElement("div");
    spacer.style.cssText = `height:${gap}px;`;
    panel.parentElement?.insertBefore(spacer, panel);
    shift += gap;
  }
}

export async function htmlDocumentToPdfFile(html: string, filename: string): Promise<File> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = html2canvasMod.default;

  // A throwaway instance purely to read the A4 page geometry (pt) needed to
  // work out where page breaks fall in captured-canvas pixels, before the
  // real capture runs. The same geometry (pageWidth/pageHeight/margin) is
  // reused below for the actual output — this isn't a second, different PDF.
  const pageMetrics = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidthPt = pageMetrics.internal.pageSize.getWidth();
  const pageHeightPt = pageMetrics.internal.pageSize.getHeight();
  const imgWidthPt = pageWidthPt - PDF_MARGIN * 2;
  const usablePt = usablePdfPageHeight(pageHeightPt, PDF_MARGIN);
  const captureCanvasWidthPx = PDF_CAPTURE_WIDTH * PDF_CAPTURE_SCALE;
  // pt-per-canvas-px is imgWidthPt / captureCanvasWidthPx (mirrors how
  // imgHeight is derived from canvas.height below) — invert it to convert
  // the page's usable height from pt into capture-canvas pixels.
  const usableCanvasPx = usablePt * (captureCanvasWidthPx / imgWidthPt);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PDF_CAPTURE_WIDTH}px;height:200px;border:0;background:#fff;`;
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error("PDF frame failed to open"));
      iframe.srcdoc = htmlForPdfCapture(html);
      window.setTimeout(() => resolve(), 1500);
    });
    const doc = iframe.contentDocument;
    const body = doc?.body;
    if (!body) throw new Error("PDF frame was empty");
    body.style.height = "auto";
    body.style.minHeight = "0";
    doc.documentElement.style.height = "auto";
    doc.querySelectorAll(".panel").forEach((panel) => {
      panel.removeAttribute("hidden");
      (panel as HTMLElement).style.display = "block";
    });
    await new Promise((r) => window.setTimeout(r, 80));
    insertPageBreakSpacers(doc, usableCanvasPx);
    const main = (body.querySelector("main") as HTMLElement | null) || body;
    const contentH = Math.max(main.scrollHeight, body.scrollHeight, 1);
    iframe.style.height = `${contentH + 4}px`;
    await new Promise((r) => window.setTimeout(r, 40));

    const rawCanvas = await html2canvas(body, {
      scale: PDF_CAPTURE_SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: PDF_CAPTURE_WIDTH,
      windowHeight: contentH,
      height: contentH,
      onclone: (clone) => {
        const root = clone.documentElement;
        root.style.height = "auto";
        clone.body.style.height = "auto";
        clone.body.style.minHeight = "0";
        clone.querySelectorAll(".panel").forEach((panel) => {
          panel.removeAttribute("hidden");
          (panel as HTMLElement).style.display = "block";
        });
      },
    });
    const canvas = cropCanvasBottom(rawCanvas);
    const img = canvas.toDataURL("image/jpeg", 0.86);
    const pdf = pageMetrics;
    const imgWidth = imgWidthPt;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const usable = usablePt;
    const pages = pdfPageCount(imgHeight, pageHeightPt, PDF_MARGIN);
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", PDF_MARGIN, PDF_MARGIN - i * usable, imgWidth, imgHeight);
    }
    const blob = pdf.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  } finally {
    iframe.remove();
  }
}

/**
 * Web Share payload for Email: PDF file only.
 * Never set `text` — Safari / Mail copies it into the message body.
 */
export function quoteEmailSharePayload(file: File, subject: string): ShareData {
  return { files: [file], title: subject };
}

/** Open Mail with the quotation PDF attached and an empty body. */
export async function emailQuotePdf(opts: {
  file: File;
  subject: string;
}): Promise<"shared" | "draft"> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    const payload = quoteEmailSharePayload(opts.file, opts.subject);
    try {
      if (nav.canShare({ files: payload.files })) {
        await nav.share(payload);
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }

  const pdfBytes = new Uint8Array(await opts.file.arrayBuffer());
  const eml = buildQuoteEmailDraft({
    subject: opts.subject,
    body: "",
    filename: opts.file.name,
    pdfBytes,
  });
  const emlName = opts.file.name.replace(/\.pdf$/i, ".eml");
  downloadBlob(emlName, new Blob([eml], { type: "message/rfc822" }));
  return "draft";
}
