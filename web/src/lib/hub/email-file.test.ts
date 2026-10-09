import assert from "node:assert/strict";
import { emailAsText, htmlToText, isEmailFileName, parseEmailFile } from "./email-file";

const b64 = (s: string) => Buffer.from(s).toString("base64");
const toBuf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

(async () => {
  assert.equal(isEmailFileName("RE Rates.msg"), true);
  assert.equal(isEmailFileName("enquiry.EML"), true);
  assert.equal(isEmailFileName("invoice.pdf"), false);

  // An email dragged out of Outlook on the web (.eml) with a text body and a packing list attached.
  const eml = [
    'From: "Ravi Kumar" <Ravi@GulfFreight.ae>',
    "To: pricing@atlaslogistics.co.in",
    "Subject: RE: Rates for fabric rolls",
    "Date: Thu, 08 Oct 2026 10:15:00 +0000",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="BOUND"',
    "",
    "--BOUND",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hi, please quote 1x20GP Chennai to Jebel Ali. Details attached.",
    "",
    "Regards,",
    "Ravi Kumar | Gulf Freight Co LLC",
    "--BOUND",
    'Content-Type: text/plain; name="packing.txt"',
    'Content-Disposition: attachment; filename="packing.txt"',
    "Content-Transfer-Encoding: base64",
    "",
    b64("24 pallets 120x100x110 gross 9500 kg"),
    "--BOUND--",
    "",
  ].join("\r\n");
  const mail = await parseEmailFile("RE Rates.eml", toBuf(eml));
  assert.equal(mail.fromEmail, "ravi@gulffreight.ae");
  assert.equal(mail.fromName, "Ravi Kumar");
  assert.equal(mail.subject, "RE: Rates for fabric rolls");
  assert.match(mail.bodyText, /1x20GP Chennai to Jebel Ali/);
  assert.equal(mail.attachments.length, 1);
  assert.equal(mail.attachments[0].name, "packing.txt");
  assert.equal(new TextDecoder().decode(mail.attachments[0].bytes), "24 pallets 120x100x110 gross 9500 kg");
  const asText = emailAsText(mail);
  assert.match(asText, /^EMAIL\nFrom: Ravi Kumar <ravi@gulffreight\.ae>/);
  assert.match(asText, /Subject: RE: Rates for fabric rolls/);

  // An HTML-only email still gives readable text.
  const html = [
    "From: sales@pearlcargo.com",
    "Subject: Enquiry",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<html><head><style>p{color:red}</style></head><body><p>Please quote <b>3 cartons</b> Shanghai&nbsp;to Bengaluru</p><br>Thanks &amp; regards</body></html>",
  ].join("\r\n");
  const h = await parseEmailFile("enquiry.eml", toBuf(html));
  assert.equal(h.fromEmail, "sales@pearlcargo.com");
  assert.match(h.bodyText, /Please quote 3 cartons Shanghai to Bengaluru/);
  assert.match(h.bodyText, /Thanks & regards/);
  assert.doesNotMatch(h.bodyText, /color:red/);
  assert.match(htmlToText("<p>a</p><p>b</p>"), /^a\s+b$/);

  // A forwarded email: the file's sender is the colleague; the original sender is further down in the text.
  const fwd = [
    'From: "Anil" <anil@blr.atlaslogistics.co.in>',
    "Subject: FW: rates please",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Please check this.",
    "",
    "-----Original Message-----",
    "From: Li Wei <liwei@shenzhen-air.com>",
    "Sent: Wednesday",
    "Subject: rates please",
    "",
    "Need air rates PVG-BLR 180 kg.",
  ].join("\r\n");
  const f = await parseEmailFile("fw.eml", toBuf(fwd));
  assert.equal(f.fromEmail, "anil@blr.atlaslogistics.co.in");
  assert.match(f.bodyText, /liwei@shenzhen-air\.com/); // kept in the text so the AI can find the original sender

  // A damaged .msg gives a clear error instead of nothing.
  await assert.rejects(() => parseEmailFile("broken.msg", toBuf("this is not an outlook file")));

  console.log("hub email-file.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
