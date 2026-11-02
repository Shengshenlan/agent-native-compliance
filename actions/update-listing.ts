import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listingView, runCheck, updateListing } from "../server/compliance/store.js";
import { CATEGORY_ENUM, guarded, MARKET_ENUM, ownerOf, PLATFORM_ENUM } from "./lib/guard.js";

export default defineAction({
  description:
    "Edit a listing's text, category, platform or target markets directly (manual edit). For agent-authored rewrites use propose-rewrite so the user can review a diff first. Re-runs the check by default.",
  schema: z.object({
    listingId: z.string(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10000).optional(),
    category: z.enum(CATEGORY_ENUM).optional(),
    platform: z.enum(PLATFORM_ENUM).optional(),
    markets: z.array(z.enum(MARKET_ENUM)).optional(),
    recheck: z.boolean().optional().default(true),
  }),
  run: async ({ listingId, recheck, ...patch }, ctx) =>
    guarded(async () => {
      const owner = ownerOf(ctx?.userEmail);
      const l = await updateListing(owner, listingId, patch);
      return recheck === false ? { listing: listingView(l) } : await runCheck(owner, listingId);
    }),
});
