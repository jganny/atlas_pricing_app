/** Quote Hub: a job is one enquiry (an email with its attachments, or a set of loose documents) read into a draft. */

export type HubMode = "air" | "sea" | "courier" | "transport" | "warehouse";
export type HubDirection = "export" | "import" | "unknown";

export interface HubPlace {
  text: string;
  /** IATA (air) or UN/LOCODE (sea), when known. */
  code: string;
  /** ISO 2-letter country. */
  country: string;
}

export interface HubPackage {
  qty: number;
  gw?: number;
  l?: number;
  w?: number;
  h?: number;
  description?: string;
}

export interface HubExtraction {
  mode: HubMode;
  modeReason: string;
  direction: HubDirection;
  directionReason: string;
  sender: { name: string; email: string; company: string };
  origin: HubPlace;
  destination: HubPlace;
  incoterm: string;
  commodity: string;
  hsCode: string;
  currency: string;
  invoiceValue: number | null;
  grossWeightKg: number | null;
  volumeCbm: number | null;
  packages: HubPackage[];
  containers: Array<{ type: string; qty: number }>;
  seaMode: "fcl" | "lcl" | null;
  specialHandling: string[];
  notes: string;
  vehicleType: string;
  storageLocation: string;
  storageDays: number | null;
  storageCbm: number | null;
  needsCheck: Array<{ field: string; note: string }>;
  summary: string;
}

export type HubJobStatus = "waiting" | "opened" | "dismissed";

export interface HubJob {
  id: string;
  createdBy: string;
  /** The desk the creator sits in — jobs are shared by desk, not tied to one person. */
  deskSeat?: string;
  createdAt: string;
  status: HubJobStatus;
  mode: HubMode;
  direction: HubDirection;
  /** Company asking for the quote, tidied against the agents list. */
  customer: string;
  senderEmail: string;
  senderName: string;
  files: string[];
  summary: string;
  checkCount: number;
  extraction: HubExtraction;
}

/** Plain pieces of a document the browser has prepared for reading. */
export type HubDocument =
  | { name: string; kind: "pdf"; mime: string; data: string }
  | { name: string; kind: "image"; mime: string; data: string }
  | { name: string; kind: "text"; text: string };

export const HUB_MODE_LABEL: Record<HubMode, string> = {
  air: "Air",
  sea: "Sea",
  courier: "Courier",
  transport: "Transport",
  warehouse: "Warehouse",
};
