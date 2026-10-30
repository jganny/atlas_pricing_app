/**
 * The in-app tour: six short steps, each a small picture of the screen with one part lit up, and a caption.
 * Plain words for newcomers. Keep it true to the app — a contract test checks the steps are complete.
 */
export interface TourBlock {
  label: string;
  /** What this part of the picture is, one or two words under the label. */
  sub?: string;
}

export interface TourStep {
  id: string;
  title: string;
  /** Spoken or read on screen. One or two short sentences. */
  caption: string;
  /** Rough seconds this step takes to read. */
  seconds: number;
  blocks: TourBlock[];
  /** Index of the block that is lit up. */
  focus: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "around",
    title: "Find your way around",
    caption:
      "The menu on the left holds your desks. Home shows what is waiting for you. The Sync button reloads your data, and “What's new” under the app name lists every change.",
    seconds: 25,
    blocks: [
      { label: "Menu", sub: "desks and tools" },
      { label: "Home", sub: "what is waiting" },
      { label: "Sync", sub: "reload data" },
    ],
    focus: 0,
  },
  {
    id: "drop",
    title: "Drop an enquiry",
    caption:
      "Drop the customer's email or invoice into the Start box on Home, or paste the text. Vertex reads the route and weight and keeps it waiting in Quote hub. Nothing opens by itself.",
    seconds: 30,
    blocks: [
      { label: "Start box", sub: "drop or type" },
      { label: "Vertex reads", sub: "route, weight" },
      { label: "Quote hub", sub: "waits for you" },
    ],
    focus: 0,
  },
  {
    id: "quote",
    title: "Quote on the Air desk",
    caption:
      "Open the job and the desk fills in. On Carriers, Vertex suggests the airlines you used on this lane. Pick one, check the freight, set each carrier's validity, then Preview and Save. Waiting for a rate? Save draft and come back.",
    seconds: 35,
    blocks: [
      { label: "Shipment", sub: "filled for you" },
      { label: "Carriers", sub: "Vertex suggests" },
      { label: "Preview, Save", sub: "or Save draft" },
    ],
    focus: 1,
  },
  {
    id: "amend",
    title: "Amend or duplicate",
    caption:
      "Open a quote in Enquiry DB and choose Amend to fix it, or Duplicate to start a copy for another customer. Each airline's validity stays as set, and turns red once it has passed.",
    seconds: 25,
    blocks: [
      { label: "Enquiry DB", sub: "find the quote" },
      { label: "Amend", sub: "fix this quote" },
      { label: "Duplicate", sub: "a new copy" },
    ],
    focus: 1,
  },
  {
    id: "won",
    title: "Mark Won, fill follow-ups",
    caption:
      "When a customer says yes, mark the quote Won. Anything still blank, like the shipper or the buy rate, waits in Won follow-ups. You see only your own desk's.",
    seconds: 25,
    blocks: [
      { label: "Mark Won", sub: "in Enquiry DB" },
      { label: "Follow-ups", sub: "your desk only" },
      { label: "Done", sub: "row clears" },
    ],
    focus: 1,
  },
  {
    id: "circulars",
    title: "Circulars and Sync",
    caption:
      "Circulars keeps tariffs in folders: station, then airline, liner or courier, then the carrier. Its fuel circular sits in the same folder. Press Sync if something looks out of date.",
    seconds: 20,
    blocks: [
      { label: "Station", sub: "e.g. Bangalore" },
      { label: "Carrier folder", sub: "tariff + FSC" },
      { label: "Sync", sub: "reload data" },
    ],
    focus: 1,
  },
];

export function tourSeconds(steps: TourStep[] = TOUR_STEPS): number {
  return steps.reduce((n, s) => n + s.seconds, 0);
}

export function clockLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
