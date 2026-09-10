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

export async function htmlDocumentToPdfFile(html: string, filename: string): Promise<File> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = html2canvasMod.default;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:200px;border:0;background:#fff;";
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
    const main = (body.querySelector("main") as HTMLElement | null) || body;
    const contentH = Math.max(main.scrollHeight, body.scrollHeight, 1);
    iframe.style.height = `${contentH + 4}px`;
    await new Promise((r) => window.setTimeout(r, 40));

    const rawCanvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 720,
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
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const usable = usablePdfPageHeight(pageHeight, margin);
    const pages = pdfPageCount(imgHeight, pageHeight, margin);
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", margin, margin - i * usable, imgWidth, imgHeight);
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
