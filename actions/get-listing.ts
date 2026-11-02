import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listingDetail } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Get one listing with its current text, per-market verdicts, every risk-board item (id, market, kind, severity, status, evidence, suggestion, cited rule + source) and any pending rewrite proposal with its diff.",
  schema: z.object({ listingId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ listingId }, ctx) => guarded(() => listingDetail(ownerOf(ctx?.userEmail), listingId)),
});
