const assert = require("assert");
const S = require("./inbox-send");

// The Sent folder: the server's own marking first, then well-known names, never Drafts or Trash.
assert.strictEqual(S.pickSentFolder([{ path: "INBOX" }, { path: "Sent Items", specialUse: "\\Sent" }, { path: "Sent" }]), "Sent Items");
assert.strictEqual(S.pickSentFolder([{ path: "INBOX" }, { path: "Drafts" }, { path: "Sent" }]), "Sent");
assert.strictEqual(S.pickSentFolder([{ path: "INBOX" }, { path: "INBOX.Sent" }]), "INBOX.Sent");
assert.strictEqual(S.pickSentFolder([{ path: "INBOX" }, { path: "Drafts" }, { path: "Archive/Sent 2025" }]), "Archive/Sent 2025");
assert.strictEqual(S.pickSentFolder([{ path: "INBOX" }, { path: "Drafts" }, { path: "Deleted Sent" }]), null);
assert.strictEqual(S.pickSentFolder([]), null);
assert.strictEqual(S.pickSentFolder(null), null);

// Addresses: clean, unique, invalid ones reported.
const a = S.parseAddresses("Ravi <ravi@acme.com>; ravi@acme.com, bad-address, x@y.co");
assert.deepStrictEqual(a.good, ["ravi@acme.com", "x@y.co"]);
assert.deepStrictEqual(a.bad, ["bad-address"]);
assert.deepStrictEqual(S.parseAddresses(["a@b.com"]).good, ["a@b.com"]);
assert.deepStrictEqual(S.parseAddresses("").good, []);

// Subjects.
assert.strictEqual(S.subjectFor("reply", "Rates BOM to NRT"), "Re: Rates BOM to NRT");
assert.strictEqual(S.subjectFor("reply", "Re: Rates"), "Re: Rates");
assert.strictEqual(S.subjectFor("forward", "Rates"), "Fwd: Rates");
assert.strictEqual(S.subjectFor("forward", "FW: Rates"), "FW: Rates");

(async () => {
  // The raw message keeps the conversation together and carries the attachment.
  const raw = (
    await S.buildRaw({
      from: '"Air Desk - Atlas Logistics" <pricing@atlaslogistics.co.in>',
      to: ["agent@example.com"],
      cc: ["boss@example.com"],
      subject: "Re: Rates BOM to NRT",
      text: "Dear Takeshi,\n\nPlease find our quotation attached.",
      inReplyTo: "<orig-123@example.com>",
      references: ["<first@example.com>", "<orig-123@example.com>"],
      attachments: [{ filename: "Quotation.pdf", content: Buffer.from("%PDF-1.4 test"), contentType: "application/pdf" }],
    })
  ).toString("utf8");
  assert.match(raw, /^Message-ID: <[^>]+@atlaslogistics\.co\.in>/im);
  assert.match(raw, /^In-Reply-To: <orig-123@example\.com>/im);
  assert.match(raw, /^References: <first@example\.com> <orig-123@example\.com>/im);
  assert.match(raw, /^Subject: Re: Rates BOM to NRT/im);
  assert.match(raw, /^To: agent@example\.com/im);
  assert.match(raw, /^Cc: boss@example\.com/im);
  assert.match(raw, /filename="?Quotation\.pdf"?/i);
  assert.doesNotMatch(raw, /^Bcc:/im, "blind copies are never written into the headers");
  console.log("inbox-send tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
