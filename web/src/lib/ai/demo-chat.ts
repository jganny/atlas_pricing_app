/** Sample answers for the demo site and mock mode, where the real assistant isn't connected. */
import type { ChatSource, ChatTag } from "./vertex-chat";

interface Reply {
  text: string;
  tags: ChatTag[];
  sources?: ChatSource[];
}

const REPLIES: Array<{ match: RegExp; reply: Reply }> = [
  {
    match: /fca|fob/i,
    reply: {
      tags: ["general"],
      text:
        "**FCA** and **FOB** both move risk to the buyer at the point of handover — the difference is *where* that is.\n\n| | FCA | FOB |\n|---|---|---|\n| Modes | Any | Sea / inland waterway only |\n| Risk passes | When goods are handed to the buyer's carrier | When goods are on board the vessel |\n| Typical use | Containers, air, road | Bulk and break-bulk by sea |\n\nFor containers FCA usually fits better, because the seller hands over at the terminal before loading. Check the latest Incoterms text for contract wording.",
    },
  },
  {
    match: /quote|quoted|last/i,
    reply: {
      tags: ["quotes"],
      text:
        "Your latest Air export quote for **Pearl Cargo Ltd**, BLR → CMB:\n\n| Field | Detail |\n|---|---|\n| Reference | AE-0412 |\n| Date | 08 Oct |\n| Cargo | 1 pallet · 120 kg |\n| Quoted | USD 1,950 total |\n| Status | Quoted |\n\n*Sample data in the demo.* Open the quote to see the breakdown before reusing it — a new shipment should be re-priced on the Air desk.",
    },
  },
  {
    match: /origin charges|courier/i,
    reply: {
      tags: ["general"],
      text:
        "On the **Courier desk**, open the **Carriers** step and scroll to *Origin and destination charges (optional)*:\n\n1. Press **Add** under *Origin charges* (or *Destination charges*).\n2. Enter the name and the amount — flat or per kg.\n3. The charges are added to every carrier's total, after GST, and itemised on the quote.",
    },
  },
  {
    match: /colombo|disruption|airport|news|today|weather/i,
    reply: {
      tags: ["web"],
      sources: [
        { title: "Airport authority — cargo notices", url: "https://example.com/notice" },
        { title: "Airline cargo advisory", url: "https://example.com/advisory" },
        { title: "Aviation news report", url: "https://example.com/news" },
      ],
      text: "Nothing major is reported for **CMB** this week. One report mentions slower cargo handling on Tuesday after an equipment fault; flights ran normally.\n\n*Sample answer in the demo — the live app searches the web in real time.*",
    },
  },
];

const FALLBACK: Reply = {
  tags: ["general"],
  text: "This is the demo, so I can only show sample answers. In the live app, Ask Vertex answers any question — freight and logistics, how to use the app, your own past quotes, current news — with sources.",
};

export async function demoAnswer(question: string, onChunk: (c: string) => void, signal?: AbortSignal): Promise<Reply> {
  const reply = REPLIES.find((r) => r.match.test(question))?.reply ?? FALLBACK;
  const words = reply.text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 3) {
    if (signal?.aborted) break;
    onChunk(words.slice(i, i + 3).join(""));
    await new Promise((r) => setTimeout(r, 18));
  }
  return reply;
}
