/**
 * Automatic acknowledgements from the pricing mailboxes.
 *
 * Pure rules and wording; the sending itself is in inbox-poll.js. Everything here is about being safe to do on its own:
 * never answer a machine, never answer twice on one thread, never answer our own people, and say only what is true.
 */
const F = require("./inbox-filter");

const OWN_DOMAINS = ["atlaslogistics.co.in"];

/** Subjects of machine-made mail that must never get an answer. */
const MACHINE_SUBJECT = /\b(automatic reply|auto[- ]?reply|autoreply|out of office|undeliverable|delivery (?:status|failure|notification)|mail delivery|returned mail|failure notice|read receipt)\b/i;

const isAddress = (a) => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(String(a || "").trim());

/**
 * May an automatic reply go to this mail's sender? Only a real person's address, on a mail that is not itself automatic,
 * not from a mailing list, not from our own domain, and not a system address.
 */
function canAutoReply({ fromAddr = "", headers = null, subject = "", ownDomains = OWN_DOMAINS }) {
  const addr = String(fromAddr || "").trim().toLowerCase();
  if (!isAddress(addr)) return { ok: false, reason: "no valid sender address" };
  const domain = addr.split("@")[1];
  if (ownDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) return { ok: false, reason: "from our own domain" };
  const flags = F.headerFlags(headers);
  if (flags.auto) return { ok: false, reason: "an automatic mail" };
  if (flags.bulk) return { ok: false, reason: "a mailing list" };
  if (MACHINE_SUBJECT.test(String(subject || ""))) return { ok: false, reason: "an automatic reply or bounce" };
  const verdict = F.prefilter({ headers, from: addr, subject: "enquiry", body: "please quote", attachments: [] });
  if (verdict.reason === "Sent by a system address") return { ok: false, reason: "a system address" };
  return { ok: true, reason: "" };
}

/** The first message of the thread this mail belongs to: replies carry it in References / In-Reply-To. */
function threadRoot(parsed) {
  const refs = Array.isArray(parsed && parsed.references) ? parsed.references : parsed && parsed.references ? [parsed.references] : [];
  return String((refs[0] || (parsed && parsed.inReplyTo) || (parsed && parsed.messageId) || "")).trim();
}

const rePrefix = (s) => (/^\s*re\s*:/i.test(String(s || "")) ? String(s).trim() : `Re: ${String(s || "(no subject)").trim()}`);

/** "Ravi Kumar" or "ravi.kumar@acme.com" -> a greeting name. */
function greetingName(fromName, fromAddr) {
  const n = String(fromName || "").replace(/["<>]/g, "").trim();
  if (n && !/@/.test(n)) return n.split(/\s+/)[0].replace(/[,;:]+$/, "");
  const local = String(fromAddr || "").split("@")[0].replace(/[._\d]+/g, " ").trim().split(/\s+/)[0] || "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Sir/Madam";
}

/** "Air Desk" / "Sea Desk" / "Sales Desk" for the mailbox and what the enquiry is about. */
function deskLabel(mailboxKey, mode) {
  if (mailboxKey === "pricingsales") return "Sales Desk";
  if (mode === "air") return "Air Desk";
  if (mode === "sea") return "Sea Desk";
  return "Pricing Desk";
}

/** The acknowledgement of an enquiry: no promise of a price or a time. */
function enquiryAck({ fromName, fromAddr, subject, desk, company = "Atlas Logistics" }) {
  const name = greetingName(fromName, fromAddr);
  return {
    subject: rePrefix(subject),
    text: [
      `Dear ${name},`,
      "",
      "Thank you for your enquiry. We acknowledge receipt, and our " + desk + " is working on it. You will receive our quotation shortly.",
      "",
      "If anything is missing or has changed (weight, dimensions, dates, incoterm), please reply to this email.",
      "",
      "Best regards,",
      desk,
      company,
    ].join("\n"),
  };
}

/** The acknowledgement of a shipment confirmation, with the branch team brought in. */
function confirmationAck({ fromName, fromAddr, subject, desk, branch, hasTeam, attached, shipper, consignee, route, company = "Atlas Logistics" }) {
  const name = greetingName(fromName, fromAddr);
  const lines = [`Dear ${name},`, "", "Thank you for the confirmation. We acknowledge the shipment" + (route ? ` (${route})` : "") + "."];
  if (shipper || consignee) lines.push("", `Shipper: ${shipper || "as per your email"}`, `Consignee: ${consignee || "as per your email"}`);
  lines.push("", hasTeam ? `Our ${branch ? `${branch} ` : ""}team is copied on this email and will take over from here for the pickup, documentation and shipment follow-up.` : "Our team will take over from here for the pickup, documentation and shipment follow-up.");
  if (attached) lines.push("", "The documents we received with your confirmation are attached for the team's reference.");
  lines.push("", "Best regards,", desk, company);
  return { subject: rePrefix(subject), text: lines.join("\n") };
}

/**
 * Which branch takes over: the Indian end of the shipment (the destination of an import, the origin of an export).
 * branchTeams: [{ branch, stations: ["BLR", "Bangalore"], emails: [] }]. A station matches by code or by place name.
 */
function branchFor(branchTeams, { direction, pol, pod }) {
  const places = direction === "import" ? [pod, pol] : direction === "export" ? [pol, pod] : [pod, pol];
  const teams = Array.isArray(branchTeams) ? branchTeams : [];
  for (const place of places) {
    const p = String(place || "").trim().toLowerCase();
    if (!p) continue;
    for (const t of teams) {
      const hit = (t.stations || []).some((s) => {
        const x = String(s || "").trim().toLowerCase();
        return x && (p === x || p.includes(x) || (x.length >= 4 && x.includes(p) && p.length >= 3));
      }) || String(t.branch || "").trim().toLowerCase() === p;
      if (hit) return t;
    }
  }
  return null;
}

const splitEmails = (v) => String(v || "").split(/[,;\s]+/).map((x) => x.trim()).filter(isAddress);

module.exports = { canAutoReply, threadRoot, rePrefix, greetingName, deskLabel, enquiryAck, confirmationAck, branchFor, splitEmails, isAddress, OWN_DOMAINS };
