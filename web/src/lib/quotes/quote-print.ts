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

export function openMailTo(subject: string, body: string): void {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

export function openWhatsApp(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function htmlForPdfCapture(html: string): string {
  return html
    .replace(/ hidden(="")?/g, "")
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
    opts.body,
    "",
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

export async function htmlDocumentToPdfFile(html: string, filename: string): Promise<File> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = html2canvasMod.default;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:1200px;border:0;background:#fff;";
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
    await new Promise((r) => window.setTimeout(r, 120));

    doc.querySelectorAll(".panel").forEach((panel) => {
      panel.removeAttribute("hidden");
      (panel as HTMLElement).style.display = "block";
    });
    await new Promise((r) => window.setTimeout(r, 80));

    const canvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 720,
      onclone: (clone) => {
        clone.querySelectorAll(".panel").forEach((panel) => {
          panel.removeAttribute("hidden");
          (panel as HTMLElement).style.display = "block";
        });
      },
    });
    const img = canvas.toDataURL("image/jpeg", 0.86);
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(img, "JPEG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
    while (heightLeft > 8) {
      position -= pageHeight - margin;
      pdf.addPage();
      pdf.addImage(img, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin;
    }
    const blob = pdf.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  } finally {
    iframe.remove();
  }
}

export async function emailQuotePdf(opts: {
  file: File;
  subject: string;
  cover: string;
}): Promise<"shared" | "draft"> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    const withFile = { files: [opts.file] };
    try {
      if (nav.canShare(withFile)) {
        await nav.share({ files: [opts.file], title: opts.subject, text: opts.cover });
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }

  const pdfBytes = new Uint8Array(await opts.file.arrayBuffer());
  const eml = buildQuoteEmailDraft({
    subject: opts.subject,
    body: opts.cover,
    filename: opts.file.name,
    pdfBytes,
  });
  downloadBlob(opts.file.name, opts.file);
  const emlName = opts.file.name.replace(/\.pdf$/i, ".eml");
  downloadBlob(emlName, new Blob([eml], { type: "message/rfc822" }));
  return "draft";
}

/** WhatsApp / share sheet with the PDF. Falls back to downloading the file. */
export async function shareQuotePdf(opts: {
  file: File;
  subject: string;
  text: string;
}): Promise<"shared" | "downloaded"> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && typeof nav.share === "function") {
    const withFile = { files: [opts.file] };
    try {
      if (nav.canShare(withFile)) {
        await nav.share({ files: [opts.file], title: opts.subject, text: opts.text });
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  downloadBlob(opts.file.name, opts.file);
  return "downloaded";
}
