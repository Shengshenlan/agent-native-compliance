import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { deleteListing } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

export default defineAction({
  description: "Permanently delete a listing together with its risk-board items and rewrite history. Only call when the user explicitly asks to delete it.",
  schema: z.object({ listingId: z.string() }),
  run: async ({ listingId }, ctx) => guarded(() => deleteListing(ownerOf(ctx?.userEmail), listingId)),
});
