// Contest-period code (written 2026-11 for the Builder.io Agent-Native Hackathon).
import { integer, now, table, text } from "@agent-native/core/db/schema";

/** A product listing (title + description) being prepared for SEA marketplaces. */
export const listings = table("listings", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** appliance | power | toy | cosmetic | auto */
  category: text("category").notNull().default("auto"),
  /** platform hint: tiktok | shopee | lazada | "" */
  platform: text("platform").notNull().default(""),
  /** JSON array of markets, e.g. ["TH","PH","MY"] */
  marketsJson: text("markets_json").notNull().default('["TH","PH","MY"]'),
  /** JSON: per-market summary from the last check (verdict, headline, risk level). */
  lastCheckJson: text("last_check_json"),
  kbVersion: text("kb_version"),
  version: integer("version").notNull().default(1),
  checkedAt: text("checked_at"),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

/** One risk item on the board (one per market x finding). */
export const issues = table("issues", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  market: text("market").notNull(),
  /** prohibited | counterfeit | brand | wording | claim | cert | cert_maybe | display | platform | customs | review */
  kind: text("kind").notNull(),
  /** high | medium | low */
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  /** offending text found in the listing (if any) */
  evidence: text("evidence"),
  suggestion: text("suggestion").notNull().default(""),
  /** 1 when changing the listing text can resolve it (vs. needing a certificate) */
  fixable: integer("fixable").notNull().default(0),
  ruleId: text("rule_id"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  quote: text("quote"),
  /** stable key so re-checks keep reviewer edits/status */
  fingerprint: text("fingerprint").notNull(),
  /** open | approved | ignored | fixed */
  status: text("status").notNull().default("open"),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

/** A proposed rewrite of a listing (agent-authored), with its diff. */
export const rewrites = table("rewrites", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  issueIdsJson: text("issue_ids_json").notNull().default("[]"),
  beforeTitle: text("before_title").notNull(),
  beforeDescription: text("before_description").notNull().default(""),
  afterTitle: text("after_title").notNull(),
  afterDescription: text("after_description").notNull().default(""),
  rationale: text("rationale").notNull().default(""),
  /** JSON: per-issue explanation [{issueId, change}] */
  changesJson: text("changes_json").notNull().default("[]"),
  /** proposed | applied | discarded */
  status: text("status").notNull().default("proposed"),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export type Listing = typeof listings.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Rewrite = typeof rewrites.$inferSelect;
