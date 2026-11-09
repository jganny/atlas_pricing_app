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
    version: "0.3.146",
    date: "2026-11-10",
    items: [
      "Sales: \u201cNew visit\u201d is now a short guided conversation. The app knows if it is a first visit (7 quick questions) or a follow-up (4), every question has tap-to-pick answers, can be typed or spoken, and can be skipped. A follow-up asks whether last time\u2019s plan happened. The answers become the visit note, with the next action and its reminder date. Admin \u2192 Visit report options lets you add, rename, reorder or hide any option, and shows what people typed under \u201csomething else\u201d.",
      "Rate cards: the circular reader now keeps every rate card, not only general cargo, tagged with its class (GCR, DGR, PHARMA, PRIORITY\u2026). On the Carrier Board and the Air desk a special card appears as its own line, named like EK-DGR or EK-PHARMA. The Air desk never adds them by itself; you pick them from the lane list.",
    ],
  },
  {
    version: "0.3.145",
    date: "2026-11-10",
    items: [
      "Air and Sea desks: every airline, liner and coloader card now has a \u201cClient copy\u201d box. Untick \u201cShow this carrier\u2019s name on the quote\u201d and the client sees \u201cAirline option 2\u201d (or Liner / Coloader) instead, on the quote, PDF, email and WhatsApp text. \u201cShow all\u201d and \u201cHide all\u201d sit above the cards.",
      "Import desks: \u201cRates procured from an Agent\u201d with the agent\u2019s name, kept inside the company. It never appears on anything the client receives, even if typed into a note or the terms. The staff preview shows it as internal.",
    ],
  },
  {
    version: "0.3.144",
    date: "2026-11-10",
    items: [
      "Carrier board: open an airline's row and you now get tabs for Rates, Surcharges (the fuel and security notices the reader wrote down), Contacts (from the Directory, with email and phone links), Portal (the link, the rule, and the stations your team has logins for) and Remarks. The rate-per-kg chart has been removed; the weight-break grid shows the same numbers.",
      "Carrier board: the From and To boxes no longer show sample airports in faint grey; they say \u201cAirport code\u201d. The big instruction box under them is gone, and so is the \u201chow each airline's rate is obtained\u201d map, which repeated what each row already says.",
    ],
  },
  {
    version: "0.3.143",
    date: "2026-11-10",
    items: [
      "The Standards section has been removed from the menu and from the app.",
      "Under Administrator tools on the Carrier board, a new button reads every circular already in the library that has not been read (airline rate tables into the Carrier board and the Air desk, everything else into a short summary), so nobody has to upload them again. It tells you the cost first, shows your AI credit, and stops before the credit runs out.",
      "On the Carrier board, the \u201chow each airline's rate is obtained\u201d map now shows Email, not Tariff, for an airline whose tariff has not been loaded yet, so it matches the list above it.",
    ],
  },
  {
    version: "0.3.142",
    date: "2026-11-10",
    items: [
      "Whoever uploads a circular is now told straight away, on screen wherever they are in the app, when its automatic read starts, finishes, is waiting (and why) or runs into a problem (and why). The same status shows under the circular on the Circulars page.",
      "Circulars from shipping lines, coloaders, transporters, warehouses, couriers and airline notices (anything that is not an airline rate table) are now read too. Press \u201cWhat it says\u201d under one to see who it is from, when it applies, a short plain-words summary, the charges it lists and the dates to act by. A summary costs a few cents. Replacing the file of an existing circular reads it again.",
      "The administrator no longer sees read status in the Carrier board's administrator tools; that box is now just the automatic-reading switch, the monthly limit, and a manual read.",
    ],
  },
  {
    version: "0.3.141",
    date: "2026-11-09",
    items: [
      "Airline tariff circulars are now read automatically the moment they are uploaded to Circulars (category Airline Tariff). Rates appear on the Carrier board and the Air desk a few minutes later. It costs about $0.25 a circular, with a monthly limit of $3 that the administrator can change or switch off under Administrator tools on the Carrier board. A read that would pass the limit waits there for the administrator.",
      "Carrier board rules now include Air France KLM Cargo (online up to 5 tonnes, then email) and Qatar Airways (a tariff on file is used first; otherwise the Octoloop portal at any weight).",
    ],
  },
  {
    version: "0.3.140",
    date: "2026-11-09",
    items: [
      "The Carrier board now has one view only, with everything on the page (the Simple/Detailed switch is gone).",
      "New weight-break grid on the Carrier board: one row per airline, one column per weight break (MIN, <45, 45+, 100+, 300+, 500+, 1000+), your weight's column shaded, like a rate shop.",
      "New Airline tariffs table at the bottom of the Carrier board: pick an airline, narrow by From and To airport, and read every saved route's rate at every weight break. Click a route to rank the airlines for it.",
      "The administrator's Read airline circulars box is now tucked away under Administrator tools; it is optional and nothing runs unless the administrator presses it.",
    ],
  },
  {
    version: "0.3.139",
    date: "2026-11-09",
    items: [
      "New Carrier board in the Library menu, open to everyone: type the airports and a weight (for example BLR to FRA, 300 kg) and see every airline's rate, lowest first, with how long each tariff stays valid. Simple view shows just the answer; Detailed view adds the figures, a rate-by-weight chart, a validity timeline and a map of how each airline's rate is obtained.",
      "You do not need to leave the Air desk to use it: when an airline circular is read, its rates are sent to the Air desk by themselves, so the airlines are added to the quote with their weight-break rates already filled (as BUY; you still enter SELL).",
      "Airlines that give rates online or by email are handled right on the Air desk's lane row: Emirates uses its tariff below 500 kg and its portal above, Lufthansa and Air India answer online up to a weight and by email above it. Open the portal, or press Draft email for a message already addressed from the Directory.",
      "Administrators see a Read airline circulars box on the Carrier board: Check only (saves nothing) or Read and save for each airline tariff circular. Each read uses the AI, about $0.25.",
      "Fuel and security surcharges are not included in the Carrier board yet.",
    ],
  },
  {
    version: "0.3.138",
    date: "2026-11-08",
    items: [
      "Admin → AI credit and cost: set a monthly budget in dollars for each AI feature (Ask Vertex, circular reading, mailbox reading and so on), and one for all AI together. When a feature reaches its budget it pauses until next month, or until you raise the limit, and your phone gets one alert. Leave a box empty for no limit.",
      "A phone alert, once a day, when a day's AI spending is far above the month's usual, and a note on the screen saying so.",
      "Ask Vertex now starts on the Quick (cheaper) setting with web search off; Deep and Web search are one tap away when a question needs them. Each person can ask 10 questions a day (50 for the administrator), down from 50 and 300.",
    ],
  },
  {
    version: "0.3.137",
    date: "2026-11-08",
    items: [
      "A magnifier button in the top bar of every page. Click it (or press /) and it opens; type a customer, a quote number, a city or a few letters, and the matches drop down. Administrators also find settings (type password, holiday or money). It closes again when you pick a result, click away or press Esc.",
      "Type a quote request into it (for example: quote air BLR to DXB 120 kg) and the last row, Start a quote from this, opens the desk already filled in.",
      "Home no longer has the big Start here box: dropping and pasting enquiries is in Quote Hub, and finding or quoting by typing is the new search button.",
      "On Home, the Air desk, Sea desk and Inbox buttons now show on phones only. On a computer they are in the left menu.",
    ],
  },
  {
    version: "0.3.136",
    date: "2026-11-07",
    items: [
      "Admin console, reorganised: a search box at the top (type password, holiday, money, email; press / to jump to it), four status tiles (AI credit, password resets, app errors, chat-only staff) that open their section, and a grouped list of every section with small counters beside anything waiting. Only one section is open at a time, so nothing is buried under a long scroll.",
      "Each Admin section has its own link (Copy link), the list remembers what you opened last, and on a phone the list becomes one tidy Section picker.",
      "Admin → AI credit and cost looks cleaner: a ring showing what is left, this month's cost, a bar for each feature that used it, and a cost-per-day chart.",
      "The yellow banner after a release now says \"Updated to v…\" with a Got it button. It used to say \"Update ready\" even when you were already on the new version.",
      "The small \"Phase 7 / 10 / 11 / 13\" labels beside page titles (Air desk, Sea desk, Transport, Warehouse, Circulars, Directory, Analytics, Docs, Finance, HR, Smart quote) are gone. New Air and Sea quotes no longer carry \"React Phase 7\" in their saved note.",
    ],
  },
  {
    version: "0.3.135",
    date: "2026-11-07",
    items: [
      "Admin → AI credit and cost (main administrator only): see how much AI credit is left, and what each month's AI use cost, split by what used it (Ask Vertex, circular upload, mailbox reading and so on) with a cost-per-day bar chart, in dollars and rupees.",
      "Type the balance shown in the Anthropic Console after each top-up. The app counts down from it and sends a warning to your phone before it runs out (you choose the level), and again straight away if the credit has already run out. The balance is an estimate, because the AI service does not share the real figure.",
    ],
  },
  {
    version: "0.3.134",
    date: "2026-11-03",
    items: [
      "Admin → Chat-only staff: bring people who don't use the Pricing app onto Vertex Chat. Paste their names, create the logins in one click, and send each person a private link (WhatsApp or copy). They choose their own password; no password is ever shared. You can see who has joined, send a new link, or turn a login off.",
      "A chat-only login can use chat, voice notes, profile and tasks, and nothing else: it cannot open any quote, customer, tariff, circular or stored file, and cannot use the assistant. It joins the Everyone chat.",
      "Vertex Chat: the welcome page where a new person sets their password.",
      "Circulars: importing a tariff sheet no longer marks every rate as dollars. It uses the sheet's Currency column, or asks which currency the sheet is in. India circulars are usually in INR.",
    ],
  },
  {
    version: "0.3.133",
    date: "2026-11-03",
    items: [
      "The red number beside Air desk, Sea desk and the other desk names in the menu is gone. Quote Hub jobs are still listed under Waiting for you in Quote Hub. The app also no longer checks for those jobs on every page.",
    ],
  },
  {
    version: "0.3.132",
    date: "2026-11-03",
    items: [
      "Team Chat and Vertex Chat: type “/” in the message box for quick actions: /quote (attach a quote card), /approve (ask for a decision), /replyby (ask for a reply by a time), /task and /remind (a private note or reminder for yourself).",
      "Approvals with a record: ask for a decision, optionally from named people. They see Approve and Decline buttons, and the answer is kept in the chat with who decided and when. You cannot approve your own request.",
      "Reply-by: ask people to reply or tap “Got it” by a time. The message shows the time, how many have answered, and turns red when late.",
      "Quote references written in a message (for example AEPAY1026IN60278) now show a small card with the quote's status. Tap it to open the quote. No prices are shown.",
      "My tasks: make a task from any message (⋯ menu, Make a task), or with /task. Only you see them. A reminder pops up when its time comes while the app is open. In Vertex Chat there is a Tasks tab; in the Pricing app it is the list icon at the top of the chat list.",
    ],
  },
  {
    version: "0.3.131",
    date: "2026-11-01",
    items: [
      "Team Chat and Vertex Chat: profile photo and status. Add a small photo and a one-line status (Available, In a meeting, Travelling, On leave, or your own words). Photos show on chat avatars; the status shows in People and under a colleague's name in a direct chat.",
      "In the Pricing app the profile button is the person icon at the top of the chat list. In Vertex Chat it is under More, then My profile.",
    ],
  },
  {
    version: "0.3.130",
    date: "2026-11-01",
    items: [
      "Team Chat: voice notes. Tap the microphone where Send would be, speak (up to 2 minutes), then tap Send. The message shows a play bar and its length. The microphone is only on while you record.",
      "Vertex Chat: a separate chat-only app that can be put on a phone's Home Screen. It uses the same login and the same chats as Team Chat in the Pricing app, so messages show up in both. It has Chats, People and More; quote cards open the quote in the Pricing app.",
    ],
  },
  {
    version: "0.3.129",
    date: "2026-10-31",
    items: [
      "Esc now closes the Quotation Preview (and any other open window). Before, it could be ignored because a hidden panel took the key.",
      "Enquiry DB search now finds a quote wherever it is. Words you type are also matched against every quote in the database, and any that are too old for the list appear in a yellow box above it (click one to open it).",
      "Quote Hub → Waiting for you: new Clear all button (asks first). Each job now also shows who added it, for which desk, and the date.",
      "Amend, Duplicate and View/Print from Enquiry DB: if the full quote cannot be read at that moment (for example a weak connection), you now get a clear message and nothing opens. Before, a blank desk page could open and Amend could then overwrite the real quote.",
    ],
  },
  {
    version: "0.3.128",
    date: "2026-10-31",
    items: [
      "Team Chat: new Forward. Hover a message (or open its ⋯ menu) and choose Forward to send its words, quote card and attachments to one or more conversations. The new message says “Forwarded from …”.",
      "Quote preview: the Email button is now called Share. It opens your device's share list (Mail, WhatsApp and more) with the PDF attached, as before.",
      "Quote preview: new Team Chat button. Pick one or more people, groups or desks and the customer PDF goes there with a quote card. The PDF never contains buy rates or GP.",
      "Courier desk: gross profit was saved as 0 even when both Buy and Sell were entered, so it did not show on the quote. It is now saved from the Buy and Sell rates (several lanes add up). If a Buy rate is missing the GP is left blank instead of showing a false 0.",
    ],
  },
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
