/** Home greeting in India time — the desks work in IST. */

const ZONE = "Asia/Kolkata";

export function homeGreeting(now: number = Date.now(), zone: string = ZONE): string {
  const hour = Number.parseInt(
    new Date(now).toLocaleString("en-GB", { timeZone: zone, hour: "numeric", hour12: false }),
    10,
  );
  if (!Number.isFinite(hour)) return "Hello";
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function homeDateLine(now: number = Date.now(), zone: string = ZONE): string {
  return new Date(now).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zone,
  });
}
