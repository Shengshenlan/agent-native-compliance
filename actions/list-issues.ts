import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listIssues } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "List risk-board items for a listing. Filter by status (open | approved | ignored | fixed) or market (TH | PH | MY | ALL), or pass comma-separated ids. 'fixable' items can be resolved by rewriting the listing text; others need certificates or offline work.",
  schema: z.object({
    listingId: z.string(),
    status: z.enum(["open", "approved", "ignored", "fixed"]).optional(),
    market: z.enum(["TH", "PH", "MY", "ALL"]).optional(),
    ids: z.string().optional().describe("Comma-separated issue ids"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ listingId, status, market, ids }, ctx) =>
    guarded(async () => ({ issues: await listIssues(ownerOf(ctx?.userEmail), listingId, { status, market, ids: ids ? ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined }) })),
});
