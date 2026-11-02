import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { decideRewrite } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Apply (or discard) a pending rewrite proposal. Applying replaces the listing text, bumps its version and re-runs the compliance check so resolved items become 'fixed'. Only do this when the user asked to apply it.",
  schema: z.object({ rewriteId: z.string(), decision: z.enum(["apply", "discard"]).default("apply") }),
  run: async ({ rewriteId, decision }, ctx) => guarded(() => decideRewrite(ownerOf(ctx?.userEmail), rewriteId, decision)),
});
