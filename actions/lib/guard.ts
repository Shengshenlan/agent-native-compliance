import { fail } from "@agent-native/core/action";

import { NotFound, ownerOf } from "../../server/compliance/store.js";

/** Run a store call; map NotFound to a clean 404 for both the agent and the UI. */
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFound) fail(e.message, { statusCode: 404 });
    throw e;
  }
}
export { ownerOf };
export const MARKET_ENUM = ["TH", "PH", "MY"] as const;
export const CATEGORY_ENUM = ["auto", "appliance", "power", "toy", "cosmetic"] as const;
export const PLATFORM_ENUM = ["", "tiktok", "shopee", "lazada"] as const;
