/** Shared date math for the app's own calendar-dropdown fields — kept
 * framework-free so both ValidityField and DatePickerField (and any future
 * one) build their calendar grid from the exact same rules. */

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function asDateValue(value: string): string {
  return parseIso(value) ? value.trim() : "";
}

export function addDays(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function monthCells(cursor: string): Array<{ iso: string; inMonth: boolean }> {
  const d = parseIso(cursor) ?? new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ iso: string; inMonth: boolean }> = [];
  for (let i = 0; i < startPad; i++) {
    const prev = new Date(year, month, 1 - (startPad - i));
    cells.push({ iso: toIso(prev), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toIso(new Date(year, month, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const trailing = cells.length - startPad - daysInMonth + 1;
    cells.push({ iso: toIso(new Date(year, month, daysInMonth + trailing)), inMonth: false });
  }
  return cells;
}
