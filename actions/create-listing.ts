import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createListing, listingView, runCheck } from "../server/compliance/store.js";
import { CATEGORY_ENUM, MARKET_ENUM, ownerOf, PLATFORM_ENUM } from "./lib/guard.js";

export default defineAction({
  description:
    "Create a product listing (title + description) to check for Southeast Asia marketplaces (TH/PH/MY), and by default immediately run the compliance check so its risk board is populated. Returns the listing id.",
  schema: z.object({
    title: z.string().min(1).max(200).describe("Listing title (Chinese or English)"),
    description: z.string().max(10000).optional().describe("Listing description / selling points"),
    category: z.enum(CATEGORY_ENUM).optional().describe("Product category; 'auto' detects it from the text"),
    platform: z.enum(PLATFORM_ENUM).optional().describe("Target platform, or empty for all of TikTok Shop / Shopee / Lazada"),
    markets: z.array(z.enum(MARKET_ENUM)).optional().describe("Markets to check, default all of TH, PH, MY"),
    runCheck: z.boolean().optional().default(true).describe("Run the compliance check right away"),
  }),
  run: async (args, ctx) => {
    const owner = ownerOf(ctx?.userEmail);
    const l = await createListing(owner, args);
    if (args.runCheck === false) return { listing: listingView(l) };
    return await runCheck(owner, l.id);
  },
});
