/**
 * Enquiry file ingest — text/PDF/Excel/Word → plain text for parseAir/SeaEnquiry.
 * Mirrors legacy AtlasEnquiryIngest accept list (without .doc binary).
 */

export const SMART_QUOTE_ACCEPT =
  ".pdf,.xlsx,.xls,.csv,.docx,.txt,.eml,application/pdf,text/plain,message/rfc822";

export interface IngestResult {
  text: string;
  source: string;
  fileName: string;
  warning?: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use CDN worker — avoids Next.js bundling issues with pdf.worker
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    pages.push(line);
  }
  return pages.join("\n");
}

async function extractExcelText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 3)) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    parts.push(`Sheet: ${name}`);
    parts.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return parts.join("\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

export async function ingestEnquiryFile(file: File): Promise<IngestResult> {
  const ext = extOf(file.name);
  const fileName = file.name;

  if (ext === "doc") {
    throw new Error(
      "Legacy .doc Word files are not supported. Save as .docx or paste the text.",
    );
  }

  if (ext === "txt" || ext === "eml" || file.type.startsWith("text/")) {
    const text = await file.text();
    return { text, source: "email-file", fileName };
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    const text = await extractPdfText(file);
    if (!text.trim()) {
      throw new Error("No text found in PDF (it may be a scanned image). Paste enquiry text instead.");
    }
    return { text, source: "pdf-cargo", fileName };
  }

  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    const text = await extractExcelText(file);
    return {
      text,
      source: "excel-text-fallback",
      fileName,
      warning: "Excel rows were converted to text for parsing — review fields before applying.",
    };
  }

  if (ext === "docx") {
    const text = await extractDocxText(file);
    return { text, source: "word-cargo", fileName };
  }

  // Fallback: try as text
  try {
    const text = await file.text();
    if (text.trim()) return { text, source: "email-file", fileName };
  } catch {
    /* ignore */
  }

  throw new Error(
    `Unsupported file type (.${ext || "unknown"}). Use PDF, Excel, Word (.docx), TXT, or EML.`,
  );
}
