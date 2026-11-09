/** Small pure helpers for the admin's option editor (kept apart from the screen so they can be tested). */
import type { VisitQuestion } from "./visit-report";

/** Adds an option, refusing blanks and repeats (the same words in the same group). */
export function addOptionTo(q: VisitQuestion, label: string, group?: string): { question: VisitQuestion; error?: string } {
  const name = label.trim();
  if (!name) return { question: q, error: "Type the new option first." };
  const g = q.grouped ? group || "Other services" : undefined;
  if (q.options.some((o) => o.label.trim().toLowerCase() === name.toLowerCase() && (o.group ?? "") === (g ?? ""))) {
    return { question: q, error: "That option is already there." };
  }
  const option = { label: name, ...(g ? { group: g } : {}) };
  if (!q.grouped) return { question: { ...q, options: [...q.options, option] } };
  // A grouped list stays together: the new option goes at the end of its own group.
  let at = -1;
  q.options.forEach((o, i) => {
    if ((o.group ?? "") === g) at = i;
  });
  const options = [...q.options];
  options.splice(at < 0 ? options.length : at + 1, 0, option);
  return { question: { ...q, options } };
}

/** Moves an option up (-1) or down (+1); at the ends nothing changes. */
export function moveOption(q: VisitQuestion, index: number, by: -1 | 1): VisitQuestion {
  const to = index + by;
  if (index < 0 || to < 0 || index >= q.options.length || to >= q.options.length) return q;
  const options = [...q.options];
  [options[index], options[to]] = [options[to], options[index]];
  return { ...q, options };
}

export function removeOptionAt(q: VisitQuestion, index: number): VisitQuestion {
  return { ...q, options: q.options.filter((_, i) => i !== index) };
}
