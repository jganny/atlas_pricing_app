import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatAmountIn, formatCurrency } from "./utils";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `formatCurrency(` call in a file with its arguments (top-level commas only, strings and brackets respected). */
function calls(text: string): Array<{ line: number; args: string[] }> {
  const found: Array<{ line: number; args: string[] }> = [];
  for (const m of text.matchAll(/formatCurrency\(/g)) {
    let depth = 1, j = m.index! + m[0].length, cur = "";
    let quote: string | null = null;
    const args: string[] = [];
    while (j < text.length && depth > 0) {
      const c = text[j];
      if (quote) {
        cur += c;
        if (c === "\\") { cur += text[j + 1]; j++; } else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") { quote = c; cur += c; }
      else if ("([{".includes(c)) { depth++; cur += c; }
      else if (")]}".includes(c)) { depth--; if (depth > 0) cur += c; }
      else if (c === "," && depth === 1) { args.push(cur); cur = ""; }
      else cur += c;
      j++;
    }
    if (cur.trim()) args.push(cur);
    found.push({ line: text.slice(0, m.index).split("\n").length, args });
  }
  return found;
}

const noCurrency: string[] = [];
const hardUsd: string[] = [];
const literalDollar: string[] = [];
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  const text = fs.readFileSync(file, "utf8");
  if (rel !== path.join("lib", "utils.ts")) {
    for (const c of calls(text)) {
      if (c.args.length < 2) noCurrency.push(`${rel}:${c.line}`);
      else if (/^\s*["']USD["']\s*$/.test(c.args[1])) hardUsd.push(`${rel}:${c.line}`);
    }
  }
  // A literal "$" printed before a rate in screen text, whatever the quote currency is: "70 kg × $" with the rate after it,
  // or "70 kg × ${rate}" written as JSX text. A `${…}` inside a template literal (a backtick earlier on the line) is fine.
  for (const m of text.matchAll(/kg[^\n×]{0,20}×[ \t]*\$(?=\{|[ \t]*\r?\n)/g)) {
    const lineStart = text.lastIndexOf("\n", m.index! - 1) + 1;
    const backticks = (text.slice(lineStart, m.index).match(/`/g) ?? []).length;
    if (backticks % 2 === 0) literalDollar.push(`${rel}:${text.slice(0, m.index).split("\n").length}`);
  }
}

assert.deepEqual(noCurrency, [], `these money amounts name no currency, so they would print as dollars: ${noCurrency.join(", ")}`);
assert.deepEqual(hardUsd, [], `these money amounts are fixed to USD whatever the quote uses: ${hardUsd.join(", ")}`);
assert.deepEqual(literalDollar, [], `a literal "$" is printed before a rate: ${literalDollar.join(", ")}`);

// The helper never guesses dollars
assert.equal(formatAmountIn(360, "INR"), formatCurrency(360, "INR"));
assert.equal(formatAmountIn(1234.5, ""), "1,234.5");
assert.equal(formatAmountIn(1234.5, undefined), "1,234.5");
assert.ok(!formatAmountIn(99, null).includes("$"));
assert.ok(formatAmountIn(360, "INR").includes("₹"));
console.log("currency contract tests passed");
