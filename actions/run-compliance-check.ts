import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { runCheck } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Run the deterministic compliance check (cited rule knowledge base for Thailand, Philippines, Malaysia: mandatory certificates, labelling/display rules, platform IP policies, customs/battery shipping, brand & counterfeit words, risky claims) on a saved listing and merge results into its risk board. Reviewer edits and statuses are kept; items no longer triggered are marked fixed.",
  schema: z.object({ listingId: z.string() }),
  run: async ({ listingId }, ctx) => guarded(() => runCheck(ownerOf(ctx?.userEmail), listingId)),
});
