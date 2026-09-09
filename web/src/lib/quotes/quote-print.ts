/** Isolated print/download so Enquiry DB chrome is never laid out for PDF. */

export function downloadTextFile(filename: string, content: string, mime = "text/html;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
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
