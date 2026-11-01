/**
 * True only in the separate Vertex Chat build (scripts/build-chat.sh, its own Hosting site). That build shows only the
 * chat: the same sign-in, the same rooms and messages as Team chat inside the Pricing app, none of the pricing desks.
 * Baked in at build time, so it is dead code in the Pricing app bundle.
 */
export const IS_CHAT_APP = process.env.NEXT_PUBLIC_CHAT_APP === "true";

/** The product name. One place, so it can be renamed later. */
export const CHAT_APP_NAME = "Vertex Chat";

/** The client this copy is set up for (shown under the product name). Another client later = change this one setting. */
export const CHAT_CLIENT_NAME = process.env.NEXT_PUBLIC_CHAT_CLIENT || "Atlas Logistics";

/** Where the full Pricing app lives, for the "Pricing app" button. */
export const PRICING_APP_URL = process.env.NEXT_PUBLIC_PRICING_APP_URL || "https://vertex-35d95.web.app/app/";
