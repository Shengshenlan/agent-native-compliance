import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { NotFound } from "../server/compliance/store.js";
import { quickRewrite } from "../server/compliance/quick-rewrite.js";
import { ownerOf } from "./lib/guard.js";

export default defineAction({
  description:
    "Fast lane: rewrite the listing title/description for the selected risk items with ONE direct LLM completion (no agent tool loop) and save it as a pending rewrite proposal (same diff / apply-rewrite flow as propose-rewrite). Returns the proposal plus timing. Does not apply it.",
  schema: z.object({ listingId: z.string(), issueIds: z.array(z.string()).min(1).max(50) }),
  run: async ({ listingId, issueIds }, ctx) => {
    const owner = ownerOf(ctx?.userEmail);
    try {
      return await quickRewrite(owner, listingId, issueIds);
    } catch (e) {
      if (e instanceof NotFound) fail(e.message, { statusCode: 404 });
      const msg = e instanceof Error ? e.message : String(e);
      // never echo provider payloads/headers; keep a short, redacted reason
      fail(`快通道改写失败：${msg.replace(/(sk|key|bearer)[^\s"]*/gi, "[redacted]").slice(0, 200)}`, { statusCode: 502 });
    }
  },
});
