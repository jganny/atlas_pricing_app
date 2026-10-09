import type { HubExtraction, HubJob } from "./types";

const blank: HubExtraction = {
  mode: "sea", modeReason: "", direction: "export", directionReason: "",
  sender: { name: "", email: "", company: "" },
  origin: { text: "", code: "", country: "" }, destination: { text: "", code: "", country: "" },
  incoterm: "", commodity: "", hsCode: "", currency: "", invoiceValue: null, grossWeightKg: null, volumeCbm: null,
  packages: [], containers: [], seaMode: null, specialHandling: [], notes: "",
  vehicleType: "", storageLocation: "", storageDays: null, storageCbm: null, needsCheck: [], summary: "",
};

/** Sample jobs shown in the demo and in mock mode, where documents can't really be read. */
export function demoHubJobs(createdBy: string): HubJob[] {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  return [
    {
      id: "demo-sea-export", createdBy, createdAt: iso(5), status: "waiting", mode: "sea", direction: "export",
      customer: "Gulf Freight Co", senderEmail: "ops@gulffreight.example.com", senderName: "Operations",
      files: ["RE Rates for fabric rolls.msg", "Commercial invoice.pdf", "Packing list.xlsx"],
      summary: "Sea export — Chennai to Jebel Ali, 24 pallets, 31.7 CBM", checkCount: 1,
      extraction: {
        ...blank, mode: "sea", direction: "export", summary: "Sea export — Chennai to Jebel Ali, 24 pallets, 31.7 CBM",
        sender: { name: "Operations", email: "ops@gulffreight.example.com", company: "Gulf Freight Co" },
        origin: { text: "Chennai", code: "INMAA", country: "IN" }, destination: { text: "Jebel Ali", code: "AEJEA", country: "AE" },
        incoterm: "FOB", commodity: "Cotton fabric rolls", currency: "USD", invoiceValue: 18450,
        grossWeightKg: 9500, volumeCbm: 31.7,
        packages: [{ qty: 24, gw: 395.8, l: 120, w: 100, h: 110 }],
        needsCheck: [{ field: "origin", note: "Invoice says “FOB Madras port” — read as Chennai." }],
      },
    },
    {
      id: "demo-air-import", createdBy, createdAt: iso(22), status: "waiting", mode: "air", direction: "import",
      customer: "Pearl Cargo Ltd", senderEmail: "sales@pearlcargo.example.com", senderName: "Sales desk",
      files: ["Enquiry.eml", "Invoice.pdf", "Packing list.xlsx"],
      summary: "Air import — Shanghai to Bengaluru, 3 cartons, 180 kg", checkCount: 0,
      extraction: {
        ...blank, mode: "air", direction: "import", summary: "Air import — Shanghai to Bengaluru, 3 cartons, 180 kg",
        sender: { name: "Sales desk", email: "sales@pearlcargo.example.com", company: "Pearl Cargo Ltd" },
        origin: { text: "Shanghai", code: "PVG", country: "CN" }, destination: { text: "Bengaluru", code: "BLR", country: "IN" },
        incoterm: "DAP", commodity: "Electronic components", currency: "USD", grossWeightKg: 180,
        packages: [{ qty: 3, gw: 60, l: 60, w: 40, h: 40 }],
      },
    },
    {
      id: "demo-transport", createdBy, createdAt: iso(41), status: "waiting", mode: "transport", direction: "unknown",
      customer: "", senderEmail: "", senderName: "",
      files: ["Truck enquiry.txt"],
      summary: "Transport — Bengaluru to Chennai, 20 ft container", checkCount: 1,
      extraction: {
        ...blank, mode: "transport", direction: "unknown", summary: "Transport — Bengaluru to Chennai, 20 ft container",
        origin: { text: "Bengaluru", code: "", country: "IN" }, destination: { text: "Chennai", code: "", country: "IN" },
        vehicleType: "20 ft container", commodity: "Machine parts",
        needsCheck: [{ field: "customer", note: "No sender details in the text — type the customer." }],
      },
    },
  ];
}
