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
