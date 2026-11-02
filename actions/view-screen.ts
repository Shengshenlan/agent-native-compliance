import { defineAction } from "@agent-native/core/action";
import { readAppState, readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { listingDetail, ownerOf } from "../server/compliance/store.js";

export default defineAction({
  description:
    "Read what the user is looking at: current route, the open listing in the compliance workbench (text, per-market verdicts, risk items) and which risk items they have selected on the board. Use it to resolve 'this listing' / 'the selected items'.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const navigation = await readAppState("navigation");
    const selection = (await readAppStateForCurrentTab("selection").catch(() => null)) as { listingId?: string; issueIds?: string[] } | null;
    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    if (selection?.listingId) {
      try {
        const d = await listingDetail(ownerOf(ctx?.userEmail), selection.listingId);
        const selected = new Set(selection.issueIds || []);
        screen.listing = { id: d.listing.id, title: d.listing.title, description: d.listing.description, version: d.listing.version, markets: d.listing.markets, verdicts: d.listing.summaries.map((s) => ({ market: s.market, label: s.label, risk: s.risk.level })) };
        screen.selectedIssues = d.issues.filter((i) => selected.has(i.id)).map((i) => ({ id: i.id, market: i.market, kind: i.kind, severity: i.severity, title: i.title, evidence: i.evidence, suggestion: i.suggestion, fixable: i.fixable }));
        screen.openIssueCount = d.issues.filter((i) => i.status === "open").length;
        if (d.pendingRewrite) screen.pendingRewriteId = d.pendingRewrite.id;
      } catch {
        screen.selection = selection;
      }
    }
    if (Object.keys(screen).length === 0) return "No application state found. Is the app running?";
    return screen;
  },
});
