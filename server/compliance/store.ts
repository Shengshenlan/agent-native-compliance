// Contest-period code: persistence for listings, risk items and rewrite proposals.
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { issues, listings, rewrites, type Issue, type Listing, type Rewrite } from "../db/schema.js";
import { analyzeListing, MARKETS, type Market, type MarketSummary } from "./analyze.js";
import { diffStats, diffText } from "./diff.js";

export const ownerOf = (email?: string | null) => email || "local@localhost";
const nowIso = () => new Date().toISOString();
const parse = <T>(s: string | null | undefined, d: T): T => { try { return s ? (JSON.parse(s) as T) : d; } catch { return d; } };

export class NotFound extends Error {}

export function normMarkets(m?: string[] | null): Market[] {
  const xs = (m || []).map((x) => x.toUpperCase()).filter((x): x is Market => (MARKETS as readonly string[]).includes(x));
  return xs.length ? [...new Set(xs)] : [...MARKETS];
}

export type ListingView = Omit<Listing, "marketsJson" | "lastCheckJson"> & { markets: Market[]; summaries: MarketSummary[] };
export const listingView = (l: Listing): ListingView => {
  const { marketsJson, lastCheckJson, ...rest } = l;
  return { ...rest, markets: normMarkets(parse<string[]>(marketsJson, [])), summaries: parse<MarketSummary[]>(lastCheckJson, []) };
};
export type IssueView = Omit<Issue, "fixable"> & { fixable: boolean };
export const issueView = (i: Issue): IssueView => ({ ...i, fixable: !!i.fixable });

export async function createListing(ownerEmail: string, input: { title: string; description?: string; category?: string; platform?: string; markets?: string[] }) {
  const row = {
    id: crypto.randomUUID(), ownerEmail, title: input.title.trim(), description: (input.description || "").trim(),
    category: input.category || "auto", platform: input.platform || "", marketsJson: JSON.stringify(normMarkets(input.markets)),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  await getDb().insert(listings).values(row);
  return (await getListingRow(ownerEmail, row.id))!;
}

export async function getListingRow(ownerEmail: string, id: string): Promise<Listing | null> {
  const [l] = await getDb().select().from(listings).where(and(eq(listings.id, id), eq(listings.ownerEmail, ownerEmail)));
  return l ?? null;
}
export async function requireListing(ownerEmail: string, id: string) {
  const l = await getListingRow(ownerEmail, id);
  if (!l) throw new NotFound(`Listing ${id} not found`);
  return l;
}

export async function listListings(ownerEmail: string) {
  const rows = await getDb().select().from(listings).where(eq(listings.ownerEmail, ownerEmail)).orderBy(desc(listings.updatedAt));
  const counts = await getDb().select({ listingId: issues.listingId, status: issues.status, severity: issues.severity }).from(issues).where(eq(issues.ownerEmail, ownerEmail));
  return rows.map((l) => {
    const mine = counts.filter((c) => c.listingId === l.id);
    return { ...listingView(l), openIssues: mine.filter((c) => c.status === "open").length, highOpen: mine.filter((c) => c.status === "open" && c.severity === "high").length, totalIssues: mine.length };
  });
}

export async function updateListing(ownerEmail: string, id: string, patch: { title?: string; description?: string; category?: string; platform?: string; markets?: string[] }) {
  const l = await requireListing(ownerEmail, id);
  const textChanged = (patch.title !== undefined && patch.title !== l.title) || (patch.description !== undefined && patch.description !== l.description);
  await getDb().update(listings).set({
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.platform !== undefined ? { platform: patch.platform } : {}),
    ...(patch.markets !== undefined ? { marketsJson: JSON.stringify(normMarkets(patch.markets)) } : {}),
    ...(textChanged ? { version: l.version + 1 } : {}),
    updatedAt: nowIso(),
  }).where(and(eq(listings.id, id), eq(listings.ownerEmail, ownerEmail)));
  return (await getListingRow(ownerEmail, id))!;
}

/**
 * Re-run the deterministic check and merge into the board by fingerprint:
 * reviewer edits/status survive; items that disappeared become "fixed"; returning items reopen.
 */
export async function runCheck(ownerEmail: string, listingId: string) {
  const l = await requireListing(ownerEmail, listingId);
  const markets = normMarkets(parse<string[]>(l.marketsJson, []));
  const res = analyzeListing({ title: l.title, description: l.description, category: l.category as never, platform: l.platform as never }, markets);
  const db = getDb();
  const existing = await db.select().from(issues).where(and(eq(issues.listingId, listingId), eq(issues.ownerEmail, ownerEmail)));
  const byFp = new Map(existing.map((e) => [e.fingerprint, e]));
  const t = nowIso();
  let added = 0, resolved = 0, reopened = 0;
  for (const [i, d] of res.issues.entries()) {
    const prev = byFp.get(d.fingerprint);
    if (!prev) {
      added++;
      await db.insert(issues).values({ id: crypto.randomUUID(), listingId, ownerEmail, market: d.market, kind: d.kind, severity: d.severity, title: d.title, detail: d.detail, evidence: d.evidence, suggestion: d.suggestion, fixable: d.fixable ? 1 : 0, ruleId: d.ruleId, sourceUrl: d.sourceUrl, sourceTitle: d.sourceTitle, quote: d.quote, fingerprint: d.fingerprint, status: "open", sortOrder: i, createdAt: t, updatedAt: t });
    } else {
      const status = prev.status === "fixed" ? "open" : prev.status;
      if (prev.status === "fixed") reopened++;
      await db.update(issues).set({ sortOrder: i, status, detail: d.detail, evidence: d.evidence, sourceUrl: d.sourceUrl, sourceTitle: d.sourceTitle, quote: d.quote, updatedAt: t }).where(eq(issues.id, prev.id));
    }
  }
  const live = new Set(res.issues.map((d) => d.fingerprint));
  for (const e of existing) if (!live.has(e.fingerprint) && e.status !== "fixed" && e.status !== "ignored") {
    resolved++;
    await db.update(issues).set({ status: "fixed", note: e.note || `v${l.version} 复检后不再命中`, updatedAt: t }).where(eq(issues.id, e.id));
  }
  await db.update(listings).set({ lastCheckJson: JSON.stringify(res.summaries), kbVersion: res.kbVersion, checkedAt: t, updatedAt: t}).where(eq(listings.id, listingId));
  return { listing: listingView((await getListingRow(ownerEmail, listingId))!), detectedCategory: res.category, kbVersion: res.kbVersion, added, resolved, reopened, total: res.issues.length };
}

export async function listIssues(ownerEmail: string, listingId: string, f: { status?: string; market?: string; ids?: string[] } = {}) {
  const conds = [eq(issues.listingId, listingId), eq(issues.ownerEmail, ownerEmail)];
  if (f.status) conds.push(eq(issues.status, f.status));
  if (f.market) conds.push(eq(issues.market, f.market));
  if (f.ids?.length) conds.push(inArray(issues.id, f.ids));
  const rows = await getDb().select().from(issues).where(and(...conds)).orderBy(asc(issues.sortOrder));
  return rows.map(issueView);
}

export async function updateIssues(ownerEmail: string, ids: string[], patch: { status?: string; title?: string; suggestion?: string; note?: string; severity?: string }) {
  if (!ids.length) return [];
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await getDb().update(issues).set({ ...set, updatedAt: nowIso() }).where(and(inArray(issues.id, ids), eq(issues.ownerEmail, ownerEmail)));
  const rows = await getDb().select().from(issues).where(and(inArray(issues.id, ids), eq(issues.ownerEmail, ownerEmail)));
  if (!rows.length) throw new NotFound("No matching issues");
  return rows.map(issueView);
}

export type RewriteView = Omit<Rewrite, "issueIdsJson" | "changesJson"> & {
  issueIds: string[]; changes: { issueId?: string; change: string }[];
  titleDiff: ReturnType<typeof diffText>; descriptionDiff: ReturnType<typeof diffText>; stats: { added: number; removed: number };
};
export function rewriteView(r: Rewrite): RewriteView {
  const { issueIdsJson, changesJson, ...rest } = r;
  const titleDiff = diffText(r.beforeTitle, r.afterTitle), descriptionDiff = diffText(r.beforeDescription, r.afterDescription);
  const a = diffStats(titleDiff), b = diffStats(descriptionDiff);
  return { ...rest, issueIds: parse(issueIdsJson, []), changes: parse(changesJson, []), titleDiff, descriptionDiff, stats: { added: a.added + b.added, removed: a.removed + b.removed } };
}

export async function proposeRewrite(ownerEmail: string, input: { listingId: string; issueIds: string[]; title: string; description: string; rationale?: string; changes?: { issueId?: string; change: string }[] }) {
  const l = await requireListing(ownerEmail, input.listingId);
  const db = getDb();
  // supersede older pending proposals for this listing
  await db.update(rewrites).set({ status: "discarded", updatedAt: nowIso() }).where(and(eq(rewrites.listingId, l.id), eq(rewrites.ownerEmail, ownerEmail), eq(rewrites.status, "proposed")));
  const row = { id: crypto.randomUUID(), listingId: l.id, ownerEmail, issueIdsJson: JSON.stringify(input.issueIds), beforeTitle: l.title, beforeDescription: l.description, afterTitle: input.title.trim(), afterDescription: input.description.trim(), rationale: input.rationale || "", changesJson: JSON.stringify(input.changes || []), status: "proposed", createdAt: nowIso(), updatedAt: nowIso() };
  await db.insert(rewrites).values(row);
  return rewriteView((await getRewriteRow(ownerEmail, row.id))!);
}

export async function getRewriteRow(ownerEmail: string, id: string) {
  const [r] = await getDb().select().from(rewrites).where(and(eq(rewrites.id, id), eq(rewrites.ownerEmail, ownerEmail)));
  return r ?? null;
}
export async function listRewrites(ownerEmail: string, listingId: string) {
  const rows = await getDb().select().from(rewrites).where(and(eq(rewrites.listingId, listingId), eq(rewrites.ownerEmail, ownerEmail))).orderBy(desc(rewrites.createdAt));
  return rows.map(rewriteView);
}

export async function decideRewrite(ownerEmail: string, id: string, decision: "apply" | "discard") {
  const r = await getRewriteRow(ownerEmail, id);
  if (!r) throw new NotFound(`Rewrite ${id} not found`);
  if (r.status !== "proposed") throw new Error(`Rewrite is already ${r.status}`);
  const db = getDb();
  if (decision === "discard") {
    await db.update(rewrites).set({ status: "discarded", updatedAt: nowIso() }).where(eq(rewrites.id, id));
    return { rewrite: rewriteView((await getRewriteRow(ownerEmail, id))!) };
  }
  await updateListing(ownerEmail, r.listingId, { title: r.afterTitle, description: r.afterDescription });
  await db.update(rewrites).set({ status: "applied", updatedAt: nowIso() }).where(eq(rewrites.id, id));
  const check = await runCheck(ownerEmail, r.listingId);
  return { rewrite: rewriteView((await getRewriteRow(ownerEmail, id))!), check };
}

export async function listingDetail(ownerEmail: string, id: string) {
  const l = await requireListing(ownerEmail, id);
  const [iss, rws] = await Promise.all([listIssues(ownerEmail, id), listRewrites(ownerEmail, id)]);
  return { listing: listingView(l), issues: iss, pendingRewrite: rws.find((r) => r.status === "proposed") ?? null, history: rws.filter((r) => r.status !== "proposed").slice(0, 5).map(({ titleDiff, descriptionDiff, ...x }) => x) };
}

export async function deleteListing(ownerEmail: string, id: string) {
  const l = await requireListing(ownerEmail, id);
  const db = getDb();
  await db.delete(rewrites).where(and(eq(rewrites.listingId, l.id), eq(rewrites.ownerEmail, ownerEmail)));
  await db.delete(issues).where(and(eq(issues.listingId, l.id), eq(issues.ownerEmail, ownerEmail)));
  await db.delete(listings).where(and(eq(listings.id, l.id), eq(listings.ownerEmail, ownerEmail)));
  return { deleted: l.id, title: l.title };
}
