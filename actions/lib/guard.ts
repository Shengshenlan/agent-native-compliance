import { fail } from "@agent-native/core/action";

import { NotFound, Unauthorized, ownerOf as storeOwnerOf } from "../../server/compliance/store.js";

/** Run a store call; map NotFound to a clean 404 for both the agent and the UI. */
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFound) fail(e.message, { statusCode: 404 });
    if (e instanceof Unauthorized) fail(e.message, { statusCode: 401 });
    throw e;
  }
}
/** Resolve the session user; 401 when there is no session (never a shared fallback tenant). */
export function ownerOf(email?: string | null): string {
  try {
    return storeOwnerOf(email);
  } catch (e) {
    if (e instanceof Unauthorized) fail(e.message, { statusCode: 401 });
    throw e;
  }
}
export const MARKET_ENUM = ["TH", "PH", "MY"] as const;
export const CATEGORY_ENUM = ["auto", "appliance", "power", "toy", "cosmetic"] as const;
export const PLATFORM_ENUM = ["", "tiktok", "shopee", "lazada"] as const;
