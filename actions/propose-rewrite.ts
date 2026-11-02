import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { proposeRewrite } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Save YOUR rewritten listing as a proposal the user reviews as a word-level diff before applying. Write the new title/description yourself so that the selected risk items are resolved: remove counterfeit/brand words, neutralise compatibility wording, drop drug-like or absolute claims, add placeholders like [认证编号待补充] for required certificate/label info (never invent certificate numbers). Keep everything else (specs, selling points, language) intact. Supersedes earlier pending proposals.",
  schema: z.object({
    listingId: z.string(),
    issueIds: z.array(z.string()).describe("Risk items this rewrite addresses"),
    title: z.string().min(1).max(200).describe("Full rewritten title"),
    description: z.string().max(10000).describe("Full rewritten description"),
    rationale: z.string().max(2000).optional().describe("One-paragraph summary of what changed and why (Chinese)"),
    changes: z.array(z.object({ issueId: z.string().optional(), change: z.string() })).optional().describe("Per-issue explanation of the change"),
  }),
  run: async (args, ctx) => guarded(() => proposeRewrite(ownerOf(ctx?.userEmail), args)),
});
