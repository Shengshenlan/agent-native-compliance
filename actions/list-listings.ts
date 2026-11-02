import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listListings } from "../server/compliance/store.js";
import { ownerOf } from "./lib/guard.js";

export default defineAction({
  description: "List the user's listings with per-market verdicts and open risk counts, newest first.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => ({ listings: await listListings(ownerOf(ctx?.userEmail)) }),
});
