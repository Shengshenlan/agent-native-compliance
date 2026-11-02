import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { updateIssues } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Edit or triage risk-board items: approve (confirmed, needs action), ignore (false positive / not applicable), reopen, or edit title / suggestion / reviewer note / severity. Accepts one id or several for bulk triage.",
  schema: z.object({
    ids: z.array(z.string()).min(1).describe("Issue ids to update"),
    status: z.enum(["open", "approved", "ignored", "fixed"]).optional(),
    title: z.string().min(1).max(300).optional(),
    suggestion: z.string().max(2000).optional(),
    note: z.string().max(2000).optional().describe("Reviewer note, e.g. why it was ignored"),
    severity: z.enum(["high", "medium", "low"]).optional(),
  }),
  run: async ({ ids, ...patch }, ctx) => guarded(async () => ({ issues: await updateIssues(ownerOf(ctx?.userEmail), ids, patch) })),
});
