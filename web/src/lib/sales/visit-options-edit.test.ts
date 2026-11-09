import assert from "node:assert/strict";
import { addOptionTo, moveOption, removeOptionAt } from "./visit-options-edit";
import { DEFAULT_QUESTIONS } from "./visit-report";

const purpose = DEFAULT_QUESTIONS.find((q) => q.id === "purpose")!;
const scope = DEFAULT_QUESTIONS.find((q) => q.id === "scope")!;

// adding
{
  const r = addOptionTo(purpose, "  Site visit ");
  assert.equal(r.error, undefined);
  assert.equal(r.question.options.at(-1)?.label, "Site visit");
  assert.equal(purpose.options.length + 1, r.question.options.length);
  assert.equal(addOptionTo(purpose, "   ").error, "Type the new option first.");
  assert.equal(addOptionTo(purpose, "payment COLLECTION").error, "That option is already there.");
}

// a grouped list keeps each option inside its own group
{
  const r = addOptionTo(scope, "Cross-stuffing", "Sea");
  const labels = r.question.options.map((o) => `${o.group}:${o.label}`);
  const i = labels.indexOf("Sea:Cross-stuffing");
  assert.ok(i > labels.indexOf("Sea:Import LCL") && i < labels.indexOf("Other services:Courier"), "at the end of the Sea group");
  assert.equal(addOptionTo(scope, "Export", "Air").error, "That option is already there.");
  assert.equal(addOptionTo(scope, "Export", "Other services").error, undefined, "the same words in another group are fine");
  assert.equal(addOptionTo(scope, "Bonded trucking").question.options.at(-1)?.group, "Other services", "no group given: Other services");
}

// moving and deleting
{
  const up = moveOption(purpose, 1, -1);
  assert.equal(up.options[0].label, "Rates / quotation");
  assert.equal(up.options[1].label, "Introduction");
  assert.equal(moveOption(purpose, 0, -1), purpose, "the first cannot go up");
  assert.equal(moveOption(purpose, purpose.options.length - 1, 1), purpose, "the last cannot go down");
  assert.equal(removeOptionAt(purpose, 0).options[0].label, "Rates / quotation");
  assert.equal(removeOptionAt(purpose, 0).options.length, purpose.options.length - 1);
}

console.log("visit options edit ok");
