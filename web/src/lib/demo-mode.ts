/**
 * True only in the separate demo build (scripts/build-demo.sh, deployed to
 * the vertex-35d95-demo Hosting site) — never in the real app. Baked in at
 * build time, so this is dead code in the real production bundle.
 */
export const IS_DEMO_BUILD = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Returns `demoText` in the demo build, else `realText` — for a handful of
 * insider terms (NRS, Free Hand) that read as jargon to an outside viewer. */
export function demoLabel(realText: string, demoText: string): string {
  return IS_DEMO_BUILD ? demoText : realText;
}
