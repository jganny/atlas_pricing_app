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
    version: "0.3.163",
    date: "2026-11-12",
    items: [
      "Every currency. The currency choice on the Air, Sea, Transport, Warehouse and Courier desks, on the Circulars sheet and when adding rates from emails is now every currency in the world (153, with their names), instead of four or five. USD, EUR, GBP and INR still come first.",
      "The rupee figure saved with a quote now uses the rate of the currency you chose: today's live market rate for that currency, or the rate you type in the rate box, which always wins. Before, any currency other than rupees was converted at the dollar's rate. If no rate is known for a currency and the live service cannot be reached, the desk asks you to type the rate instead of guessing. The customer's total is never changed.",
      "Enquiry DB: Average GP % by user. Under the GP figure there is now the overall average GP % of sell and a link, Average GP % by user, which breaks it down per user or desk: total GP divided by total sell, so a big quote counts for more than a small one. Every breakdown now also has a GP % column, and you can compare the last 1, 3, 6 or 12 months (the change is shown in percentage points). Choose Average GP % in the breakdown to sort by it.",
    ],
  },
  {
    version: "0.3.162",
    date: "2026-11-11",
    items: [
      "The bell. A bell in the top bar keeps your own list of what happened: new enquiries and ones nobody has opened (Needs you), and rates read from a vendor's reply, a circular filed or a circular to file by hand (Updates). It shows how many are unread, opens the enquiry when you click one, and keeps 7 days. Only a title and one line are kept, never the email.",
      "Circulars never go missing silently. A strip at the top of the Inbox says what was filed into the Circulars tab today, and lists any circular that came as plain words with no file so you can file it by hand. An airline circular such as Etihad Cargo's fuel circular is now recognised as an airline fuel circular (it used to be filed as general).",
      "On every email, a Contact saved tag shows when the sender is in the contact directory, with what kind of contact it is.",
      "The evening line to the Manager now also says how many were answered today.",
    ],
  },
  {
    version: "0.3.161",
    date: "2026-11-11",
    items: [
      "Rates are now read by themselves. Every few minutes the app looks at the replies that were tied into a conversation (vendors, airline sales agents, overseas agents). A reply that carries rates is read, including a rate sheet attached as a PDF, and the rates appear in the Conversation box (\"Rates read automatically: 500 kg+: 730/kg · all-in · INR · All Nippon Airways\") without anyone pressing anything. A reply with no rates, such as thanks or will revert, is not read and costs nothing.",
      "When you open the Air or Sea desk from that enquiry, step 2 (Carriers) already lists the rates read from its conversation, and new ones appear as they arrive. You type your margin, confirm only what the app cannot know (a currency outside India, an unknown airline), choose which options go to the customer, and add them.",
      "Emails you upload or paste on the desk are read the moment you add them: there is no Read rates button to press any more (a Read again button appears only if a read did not work).",
      "AI credit: this uses AI (Haiku 5.5, about ₹0.30 or less per reply that carries rates, nothing for the rest). A cap of 100 reads a day applies (the admin can change it), and the AI on/off switch and the monthly budget apply as for every AI feature.",
    ],
  },
  {
    version: "0.3.160",
    date: "2026-11-11",
    items: [
      "Conversations. The enquiry that came in, what you sent on to vendors from Outlook, and the vendors' replies are now tied together by themselves. Open an enquiry in the Inbox and a Conversation box shows them in order, with who was asked and who has replied. The app uses the email's own thread marks, Outlook's conversation mark (which survives a changed subject), the original enquiry or its ticket number found inside your forward, and the same airports and weight close in time. When two enquiries fit equally it links the closest one and marks it Please check, so nothing is left unlinked.",
      "Every link can be corrected. Press Looks right to confirm, Move to send an email to another enquiry, or Unlink if it does not belong (an unlinked email is left alone so it does not jump back; Move puts it where it belongs). A reply that was not tied in can be linked by hand.",
      "Search mail. A Search mail button in the Inbox searches the real mailboxes (pricing@ and pricingsales@, Inbox and Sent) for any word in the sender, subject or email, last 30 days to start, up to a year. Results are grouped into conversations and open live. Nothing is saved in the app, so mail that already left the list is found too.",
      "Work bar. A line across the top of every screen shows the enquiry that is waiting: amber when it is new, red when nobody has opened it for 20 minutes or it is past its time. It cannot be closed and goes away when the enquiry is opened. The browser tab shows the count, for example (2) Atlas Pricing, and a short chime plays when something turns red (you can mute it).",
      "Contact directory: contacts are now sorted into more kinds: GSA, CSA, coloader, packer, customs broker, courier, forwarder, besides airline, liner, NVOCC, transporter, overseas agent and the rest. People you send to from Outlook are saved too. Overseas agents found here are not added to the weekly agency list.",
      "Rates from emails, on the Air and Sea desks (step 2, Carriers). Upload the emails a vendor, an airline's sales agent or an overseas agent sent (several are fine, from one agent or many), or paste the text. AI reads each one (about ₹0.30 or less per email, only when you press Read rates) and each becomes its own option with the vendor's rate as your cost. A rate sent from within India with no currency is taken as rupees (shown as assumed); a code such as NH becomes All Nippon Airways; anything unclear (currency, airline, container type) must be confirmed before it can be added. You type your margin once and every sell rate is made from it. For Import, tick Rate from an agent: the agent's name never reaches the customer.",
      "Choose what the customer sees. Every option on the desks now has Send this option to the customer. Untick the ones you do not want to show: the customer gets the comparison of the rest (the quoted offer is always sent), and a left-out option or agent name is also removed from notes and terms.",
      "In a conversation, a reply has Use these rates in the desk: it is kept for the Carriers step of the Air or Sea desk. A vendor who has not answered shows how long it has waited, and turns red after a day, a hint to call. Vendors can answer days later: the conversation is kept up to 15 days, also after the quote is saved.",
      "While the Sea Nom seat is vacant, sea enquiries on pricing@ also appear for NRS and Free Hand, who are alerted too.",
      "Team board (button in the Inbox): per mailbox, how many are open, late, not opened and being quoted, and who has what. Leave it open on a second screen. The Manager also sees a Needs attention card on Home, and gets one line on the phone each evening at 6:30 pm: how many came in today and who is still waiting.",
      "Only reading rates from emails uses AI credit (and it is covered by the AI on/off switch). Everything else in this release is free of AI credit.",
    ],
  },
  {
    version: "0.3.159",
    date: "2026-11-11",
    items: [
      "AI on/off switch. Admin > AI credit and cost now has a master switch and a switch for each of the nine places the app uses AI, each listed with where you meet it, what it costs and who uses it. When one is off, the button says so in plain words and the work is done by hand; nothing is lost. A small label in the top bar tells everyone whether AI is on, and for which features it is off. The switch uses no AI credit.",
      "Enquiry DB: click In view, Sell, GP or Tonnage to see what the number is made of. Group it by mode, desk, customer, carrier, lane, status or month, with each group's share, win rate and GP split into won, open and lost. Compare the last 1, 3, 6 or 12 months with the same number before. Click a row to show only those quotes in the table. CSV export included. Staff only; no AI credit.",
      "Multilingual quotations. In the quotation preview, pick a Document language: the customer's copy shows English with Arabic, Spanish, French, German, Portuguese or Italian beside it. The app suggests one from the customer's email address (for example .ae gives Arabic, .es gives Spanish). Carrier names, charge names you typed and the terms and conditions stay in English, and the document says so. Please have a native speaker read one sample of each language before first use. No AI credit.",
    ],
  },
  {
    version: "0.3.158",
    date: "2026-11-11",
    items: [
      "Replies you send from Outlook are now noticed by the app. When you answer an enquiry in Outlook, it shows \"Replied from Outlook\" in the Inbox, it stops counting as due or late, and the reminders for it stop. Nothing is changed in the mailbox: the app only reads the Sent items.",
      "Admin > Automatic replies now says plainly that sending from the app is paused until the mail server's certificate is renewed.",
    ],
  },
  {
    version: "0.3.157",
    date: "2026-11-11",
    items: [
      "Inbox: a new folder, Escalations and discrepancies. A conversation about a problem on a shipment (a discrepancy, shortage, damage, delay or claim) is kept for the team of the mailbox it arrived at, and for anyone copied on the email, until someone marks it resolved. Air Nom and Sea Nom see pricing@, Free Hand and NRS see pricingsales@. It does not clutter the enquiries you need to quote.",
      "Inbox: labels. Enquiries about dangerous goods, pharma, perishables, with a client deadline, or with the details only in an attachment now carry a tag and have a folder of their own. Worked out by fixed rules, no AI credit.",
      "Admin > Contact directory: the app now remembers the email addresses it meets (the address, the name and how often, never what was said): airlines, liners, NVOCCs, transporters, overseas agents, exporters, importers, traders, warehousers. Known airlines and liners are sorted by themselves; the admin confirms the rest and sets how a rate is obtained from each (tariff on file, online portal, or by email).",
      "Air and Sea desks: under a carrier's name, a line says how to get a rate from it, for example the email address to ask, when the directory knows that carrier.",
    ],
  },
  {
    version: "0.3.156",
    date: "2026-11-11",
    items: [
      "Inbox: a cleaner, more professional look. Folders have icons and coloured counts, each enquiry shows a coloured urgency dot and its time left, the actions sit in a bar above the email, and the email reads in a clear, spacious layout with the sender's initials. The three panes scroll on their own so the list stays in view while you read.",
    ],
  },
  {
    version: "0.3.155",
    date: "2026-11-11",
    items: [
      "Inbox rebuilt in an Outlook style: folders with counts on the left (All open, I am quoting, Others are quoting, Due within the hour, Past its time, Follow-ups, Air, Sea, and each mailbox), the list in the middle, and the whole email on the right with its attachments, which you can open. The email is opened live from the mailbox and is not saved in the app.",
      "The list is ordered by when a reply is due. If the email states its own deadline (for example \"by 3 pm IST\" or \"within 2 hours\") that is the time; otherwise the sender's office closes at 18:00 in their country, so Tokyo comes before Bangkok and India. Each row shows the time left.",
      "Quote now has a choice: Text only (free, filled from the words of the email) or AI (reads the attachments too, about 1 rupee). Emails with attachments start on AI; you can switch. The customer is the sender's name, no longer the email address. Claim for me is gone: nobody has to press it.",
      "When two people share a mailbox, you see who is quoting an enquiry. You can ask them to hand it over; they see your request with Hand over and I am on it. If they do not answer in 20 minutes you can take it over.",
      "Alerts (for people who have turned on notifications in chat): the people on a mailbox are told when an enquiry arrives, reminded after 20 minutes if nobody has opened it, and the manager is told after 60 minutes.",
    ],
  },
  {
    version: "0.3.154",
    date: "2026-11-11",
    items: [
      "Enquiry DB: GP now shows in three colours by outcome. Green is Won (profit earned), blue is Open or quoted (estimated), red is Lost or cancelled (the margin that was offered). The top strip shows the three GP totals side by side, so earned profit is no longer mixed with estimates. Everyone can see all of them. GP is never shown on anything a customer receives.",
      "Inbox: when two people share a mailbox (Air Nom and Sea Nom on pricing@, Free Hand and NRS on pricingsales@), an enquiry shows who is already quoting it, for example \"Shaheer is quoting\". If you press Quote on one someone else has open, you are told first and can open it anyway. The note stays until the quote is saved or the other person takes it over, so someone away from the desk keeps their enquiry.",
    ],
  },
  {
    version: "0.3.153",
    date: "2026-11-10",
    items: [
      "Air desk, Air Nom seat: on EXW terms the local origin charges now fill in by themselves as Pickup (you enter the amount), Handling / C.Clr and Fumigation. On FCA terms it is the same without Pickup. Handling is the higher of 0.15 per kg and 75 below 500 kg, then 0.10 per kg from 500 kg and 0.07 per kg from 1000 kg, on the chargeable weight, in USD, EUR or GBP (the same figures in each). Fumigation is 35 per invoice. Anything you type or change is never overwritten.",
      "Air desk: the cheaper weight break is now chosen automatically. If billing the next break on its starting weight costs less (for example 290 kg billed as 300 kg at the +300 rate), the freight is billed that way and the line says so. 250 kg with +100 at 5.2 and +300 at 4.9 stays on +100, because the breakeven weight is 282.7 kg. The Carrier Board uses the same rule.",
      "Weight breaks: a +250 kg break now exists on the Air desk, the Circulars screen and the Carrier Board, for airlines such as Etihad and Malaysia that print a 250 kg rate. Tariffs without a +250 rate behave as before.",
    ],
  },
  {
    version: "0.3.152",
    date: "2026-11-10",
    items: [
      "Air desk: on the carriers page, each airline now shows only the weight break that matches the weight entered (for example the +100 kg rate for 150 kg), instead of the whole slab card. \"Show all breaks\" still opens the full card. If the matching break has no rate yet, the other breaks that do hold a rate stay visible so a quote never looks as if its freight went missing.",
    ],
  },
  {
    version: "0.3.151",
    date: "2026-11-10",
    items: [
      "Enquiry DB: the summary strip at the top now also shows the total Tonnage of the quotes in view, next to SELL and GP. Kilograms are shown in tonnes, and a sea revenue tonne counts as one tonne. It follows your filters.",
    ],
  },
  {
    version: "0.3.150",
    date: "2026-11-10",
    items: [
      "Admin > AI credit and cost: a switch to read enquiry emails with a cheaper AI model first. If the cheaper read misses the mode, the lane or the cargo, the stronger model reads the email again, so a desk is never left emptier than before. Off until you have tried it on a few real enquiries.",
    ],
  },
  {
    version: "0.3.149",
    date: "2026-11-10",
    items: [
      "Shipment confirmations: an email that confirms a shipment and names the shipper and consignee (in the text, or in an attached invoice and packing list) is recorded in NRS and the NRS desk is notified. The email is not kept in the Inbox. The documents are read by the AI only when the text does not name both parties.",
      "Automatic replies (Admin > Automatic replies, both off until you turn them on): every real enquiry is acknowledged by its desk, and every confirmation is acknowledged to the agent with the right branch team copied (Indian end of the shipment) and the documents received attached. Once per email thread, never to machines, mailing lists or your own people, with a daily ceiling, a test mode that sends everything to one address, a test button and a log of what was sent.",
    ],
  },
  {
    version: "0.3.148",
    date: "2026-11-10",
    items: [
      "Inbox: a tariff or circular emailed by an airline, liner, courier or transporter is filed into the Circulars tab by itself (the circular reader then picks it up) and the email is not kept in the app. The same file arriving twice is filed once.",
      "Nothing stays longer than it is needed. An enquiry is removed from the app as soon as its quote is saved, or when you set it aside; a daily clean-up removes anything left over (opened more than 7 days ago, or unopened for 30 days). The emails themselves always stay in the mailbox.",
      "Quotes made from an Inbox email remember it: the quote preview has \u201cReply to \u2026\u201d, which opens a draft addressed to the sender, with \u201cRe: \u2026\u201d, the cover text and the quote PDF attached, ready to send.",
    ],
  },
  {
    version: "0.3.147",
    date: "2026-11-10",
    items: [
      "Inbox: the pricing and pricingsales mailboxes are now sorted before anything is kept. Newsletters, automatic mail, bounces and mail with no enquiry in it are dropped for free; clear quote requests are kept; only the unclear ones are asked of a small AI model. Nothing in the mailbox is marked read or moved.",
      "Inbox: a mail that only says \u201cplease quote\u201d and puts the details in an attachment (a packing list, a sheet, a photo) counts as an enquiry. The AI is asked even less: replies on a thread already kept, and senders who have never sent an enquiry, are not sent to it, and its question and answer are shorter.",
      "Inbox: \u201cQuote on Air / Sea desk\u201d now reads the whole email and its attachments (once, only when you action it) and fills the desk with the customer, lane, cargo, weight and incoterm. It uses a little AI credit; emails nobody opens cost nothing.",
    ],
  },
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
