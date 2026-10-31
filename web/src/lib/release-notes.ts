/**
 * "What's new" — one short plain-language entry per release, newest first.
 * Written for the desks, not for developers: say what they will notice, not what changed in the code.
 * Add the entry in the same change that bumps NEXT_PUBLIC_APP_VERSION (a contract test checks it).
 */
export interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.3.127",
    date: "2026-10-31",
    items: [
      "Fixed a currency mix-up on the Air desk: the freight line under Quoted summary printed a dollar sign (for example “70 kg × $360”) even when the quote was in INR. Every rate now shows in the quote's own currency, including the freight line and the weight-break comparison on the airline card.",
      "A Circulars tariff in a different currency from the quote (for example a USD tariff on an INR quote) is no longer filled in silently. A notice says so and offers to switch the quote to the tariff's currency. Applies to the Air and Sea desks.",
      "Courier desk: if a tariff-priced card is in a different currency from the quote, preview and save pause until the currency matches, so figures are never saved under the wrong currency.",
      "Performance report: the GP total was shown with a dollar sign but is in rupees. Now shown in INR like Revenue.",
      "Won follow-ups, the NRS list and the Smart Quote result no longer assume dollars when a quote's currency isn't known; they show the quote's own currency.",
      "Quotes saved by the older app now print correctly. A flat minimum charge was shown as “15 kg × $405 = $405”, an option total showed $0.00 and the origin charges were missing. The customer copy now shows “Base freight (minimum charge)”, every charge itemised, and a total that adds up. The Air desk and Enquiry DB also label a minimum charge as a minimum instead of a per-kg rate.",
      "The customer copy of a quote no longer says “(from Buy)” beside a rate. That note stays on the internal screen only.",
    ],
  },
  {
    version: "0.3.126",
    date: "2026-10-30",
    items: [
      "EXW sea export: the agent's sheet amounts now fill in the Buy column only. Sell is left empty for you to price. Until you enter a Sell, the quote total uses the Buy figure as a placeholder.",
    ],
  },
  {
    version: "0.3.125",
    date: "2026-10-30",
    items: [
      "The two nomination desks now cover each other: Air Nom can open the Sea desk, and Sea Nom can open the Air desk. Each still lands on their own desk when they sign in.",
      "A booking handed to NRS is listed as Air or Sea by the shipment itself, so a sea quote made by Air Nom shows as a Sea nomination.",
      "EXW charges you have filled are yours to change: edit an amount, rename or delete a line, or add your own. Switching the port, stuffing or containers no longer overwrites your changes. “Fill again from the agent's sheet” brings the sheet's figures back when you want them.",
    ],
  },
  {
    version: "0.3.124",
    date: "2026-10-30",
    items: [
      "Enquiry DB: Status and the Won switch now sit right after Ref and Date, so they are on screen without scrolling sideways. Very long customer names and lanes are shortened (hover to read them in full), which also stops the table running off the screen.",
    ],
  },
  {
    version: "0.3.123",
    date: "2026-10-30",
    items: [
      "Sea export on EXW terms: the local charges now fill in by themselves from the agents' sheet for the origin port (Mumbai, Chennai, Mundra, and the Bangalore, Hyderabad and Delhi ICDs). Choose factory or CFS / ICD stuffing on the card. Charges are per 20' or 40' for the containers on the quote, and any amount the sheet says “will revert” keeps its note.",
      "Anything entered per kilo, per cbm or per container now shows its working on the quote, the same way base freight does. For example Handling prints as “8582.80 kg × $0.06 = $514.97”.",
      "Circulars: the documents now come first, and the FedEx / courier upload and tariffs sit below them.",
      "Circulars: “Review suggestions” fills in missing stations from the airport code in the title (for example EK_BLR becomes Bangalore). You tick the ones to keep, then press Apply.",
      "Save draft now works on the Courier, Transport and Warehouse desks too.",
      "Fuel circulars from shipping lines now sit in the Liner folders, with their tariff.",
      "Enquiry DB: a Won switch on Air Nom and Sea Nom quotes. One tap moves the quote to Won and tells NRS, who fill in the shipper, consignee and commodity. Undo stays open for 10 seconds.",
      "A little colour: each kind of shipment and each status has its own colour in Enquiry DB, each desk's title and menu entry carries its colour, and the Home tiles are tinted.",
      "The factory / CFS stuffing choice is now a sliding switch.",
    ],
  },
  {
    version: "0.3.122",
    date: "2026-10-30",
    items: [
      "Faster Enquiry DB: it now shows 150 quotes at a time, with “Show 150 more” and “Show all”. Opening it no longer freezes the screen while 1,200 rows are drawn.",
      "Faster Circulars: the spreadsheet reader loads only when you import a file, not every time you open the page.",
    ],
  },
  {
    version: "0.3.121",
    date: "2026-10-30",
    items: [
      "New Home page. One Start box takes a dropped email or invoice, a pasted email, or a typed request. Below it: what is waiting for you, this month's numbers, and a bar for each desk (the admin sees every desk, everyone else sees their own).",
      "On the Air and Sea Carriers step, Vertex suggests the airlines or liners your team has used on that lane before, with whether a tariff is on file. One tap adds it.",
      "Save draft on the Air and Sea desks: park a quote while you wait for a rate, note what you are waiting for, and Continue it later from Drafts. A draft is not a quote.",
      "Circulars now open as folders: station, then airline, liner or courier, then the carrier. A carrier's tariff and its fuel circular sit together. Files without a stored copy are marked.",
      "Take the tour: a short guided walkthrough, under the app name. Captions on screen, with an optional read-aloud.",
    ],
  },
  {
    version: "0.3.120",
    date: "2026-10-30",
    items: [
      "Validity is now yours to set for each airline, liner or co-loader. Nothing is filled in automatically any more, and there is no standard 15 days.",
      "Pick a date from the calendar, use a quick +7d / +15d / +30d button, or type your own words. A date that has passed is flagged in red, including on an amended or duplicated quote.",
    ],
  },
  {
    version: "0.3.119",
    date: "2026-10-30",
    items: [
      "Won follow-ups now show only your own desk's pending quotes. The admin sees everyone's, with a by-person bar.",
      "Validity dates print as a real date (for example 14 Nov 2026) on the quote.",
      "Click “Station not set” on a circular to choose the station right there.",
      "The count beside a desk now says what it counts when you hover over it (jobs waiting from Quote Hub).",
      "The Refresh button is now called Sync. When a new version arrives you can read what changed before you update.",
      "Exchange rates are labelled as reference (mid-market) rates.",
    ],
  },
  {
    version: "0.3.118",
    date: "2026-10-29",
    items: [
      "A new Ask Vertex emblem: three glowing strides that float and lean toward your pointer.",
    ],
  },
  {
    version: "0.3.117",
    date: "2026-10-21",
    items: [
      "Type a quote request in Ask Vertex (“quote air BLR to LHR 120 kg use EK +100 add 10/kg in USD”) and the desk opens already filled.",
      "Quote Hub instructions now work on the Sea desk as well as Air, and understand plain words.",
    ],
  },
];

/** "0.3.119-test-app" -> "0.3.119" */
export function baseVersion(version: string): string {
  return version.replace(/-(test-app|demo)$/, "");
}

export function notesFor(version: string): ReleaseNote | undefined {
  const v = baseVersion(version);
  return RELEASE_NOTES.find((n) => n.version === v);
}
