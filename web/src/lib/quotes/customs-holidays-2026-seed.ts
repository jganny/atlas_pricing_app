/**
 * Atlas's own 2026 branch holiday calendar, transcribed from "Holiday List
 * 2026.pdf". Kept in this compact (month, day) → name shape rather than 150+
 * hand-typed ISO dates, so the expansion below is the only place a date is
 * actually computed — less room for a transcription slip.
 *
 * One resolved ambiguity worth knowing: the legend lists both "Aug 25,26
 * Id-E-Milad" and "Aug 26 Onam" — but every branch's own day-list that
 * includes day 26 is consistent with Id-E-Milad alone (the Kerala branches
 * that would observe Onam show 25+26 together, matching Id-E-Milad's own
 * two days, not a separate Onam day). So every Aug 26 below resolves to
 * Id-E-Milad. Flagging this so it's easy to correct via the admin screen if
 * that reading turns out wrong for a specific branch.
 */
import type { CustomsHoliday } from "./customs-holidays";

type MonthDays = Partial<Record<number, number[]>>; // month (1-12) -> days

const BRANCH_DAYS_2026: Record<string, MonthDays> = {
  Ahmedabad: { 1: [14, 26], 3: [4, 21, 31], 4: [3, 14], 5: [27], 6: [26], 8: [15, 26, 28], 9: [4], 10: [2, 20, 31], 11: [8, 10, 11, 24], 12: [25] },
  Bangalore: { 1: [15, 26], 3: [19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [1, 8, 24], 12: [25] },
  Bhubaneshwar: { 1: [1, 26], 3: [4], 5: [1], 7: [16], 9: [14], 10: [2, 20, 21], 12: [25] },
  Calicut: { 1: [26], 3: [20, 31], 4: [3, 15], 5: [1, 27], 6: [25], 8: [15, 25, 26], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Chennai: { 1: [15, 26], 3: [21, 31], 4: [3], 5: [1, 28], 6: [26], 8: [15, 26], 9: [14], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Cochin: { 1: [26], 3: [20, 31], 4: [3, 15], 5: [1, 27], 6: [25], 8: [15, 25, 26], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Delhi: { 1: [26], 3: [4, 21, 26, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [4], 10: [2, 20], 11: [8, 24], 12: [25] },
  Goa: { 1: [26], 3: [4, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [4, 14], 10: [2, 20], 11: [8, 24], 12: [25] },
  Hyderabad: { 1: [14, 26], 3: [19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [8, 24], 12: [25] },
  Kandla: { 1: [14, 26], 3: [4, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [4], 10: [2, 20], 11: [8, 24], 12: [25] },
  Kannur: { 1: [26], 3: [20, 31], 4: [3, 15], 5: [1, 27], 6: [25], 8: [15, 25, 26], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Kolkatta: { 1: [23, 26], 3: [4, 31], 4: [3, 14], 5: [1, 28], 6: [26], 8: [26], 10: [2, 19, 20], 11: [16, 24], 12: [25] },
  Mumbai: { 1: [26], 3: [3, 19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [8, 24], 12: [25] },
  Nagpur: { 1: [26], 3: [3, 19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [8, 24], 12: [25] },
  Pune: { 1: [26], 3: [3, 19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [8, 24], 12: [25] },
  Trivandrum: { 1: [26], 3: [20, 31], 4: [3, 15], 5: [1, 27], 6: [25], 8: [15, 25, 26], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Tuticorin: { 1: [15, 26], 3: [21, 31], 4: [3], 5: [1, 28], 6: [26], 8: [15, 26], 9: [14], 10: [2, 19, 20], 11: [8, 24], 12: [25] },
  Vishakapatnam: { 1: [14, 26], 3: [19, 21, 31], 4: [3], 5: [1, 27], 6: [26], 8: [15, 26], 9: [14], 10: [2, 20], 11: [8, 24], 12: [25] },
};

/** month-day -> name, for every day that appears anywhere above. */
const NAME_BY_MONTH_DAY: Record<string, string> = {
  "1-1": "New Year's Day",
  "1-14": "Makar Sankranti / Pongal",
  "1-15": "Makar Sankranti / Pongal",
  "1-23": "Netaji Birthday",
  "1-26": "Republic Day",
  "3-3": "Holi",
  "3-4": "Holi",
  "3-19": "Ugadi",
  "3-20": "Idu'l Fitr",
  "3-21": "Idu'l Fitr",
  "3-26": "Ram Navami",
  "3-31": "Mahavir Jayanthi",
  "4-3": "Good Friday",
  "4-14": "Bengali New Year",
  "4-15": "Vaisakhadi / Bhag Bihu",
  "5-1": "Labour Day / Buddha Purnima",
  "5-27": "Bakrid",
  "5-28": "Bakrid",
  "6-25": "Muharram",
  "6-26": "Muharram",
  "7-16": "Rath Jatra",
  "8-15": "Independence Day",
  "8-25": "Id-E-Milad",
  "8-26": "Id-E-Milad",
  "8-28": "Raksha Bandan",
  "9-4": "Krishna Janmastami",
  "9-14": "Ganesh Chaturthi",
  "10-2": "Gandhi Jayanthi",
  "10-19": "Maha Navami",
  "10-20": "Dussehra / Vijaydashmi",
  "10-21": "Dussehra / Vijaydashmi",
  "10-31": "Sardar Vallabhbhai Patel Birthday",
  "11-1": "Kannada Rajyotsava",
  "11-8": "Deepavali (Diwali)",
  "11-10": "New Year",
  "11-11": "Bhai Duj",
  "11-16": "Chatt Pooja",
  "11-24": "Guru Nanak Jayanthi",
  "12-25": "Christmas",
};

export function buildCustomsHolidays2026(): Array<Omit<CustomsHoliday, "id">> {
  const rows: Array<Omit<CustomsHoliday, "id">> = [];
  for (const [branch, months] of Object.entries(BRANCH_DAYS_2026)) {
    for (const [monthStr, days] of Object.entries(months)) {
      const month = Number(monthStr);
      for (const day of days ?? []) {
        const name = NAME_BY_MONTH_DAY[`${month}-${day}`];
        const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        rows.push({ branch, date, name: name || "Holiday" });
      }
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
}
