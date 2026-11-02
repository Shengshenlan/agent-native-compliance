// Contest-period code. Additive, idempotent SQL migrations (SQLite + Postgres compatible).
import { runMigrations } from "@agent-native/core/db";

export const runComplianceMigrations = runMigrations(
  [
    {
      version: 1,
      name: "create-listings",
      sql: `CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'auto',
        platform TEXT NOT NULL DEFAULT '',
        markets_json TEXT NOT NULL DEFAULT '["TH","PH","MY"]',
        last_check_json TEXT,
        kb_version TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        checked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      version: 2,
      name: "create-issues",
      sql: `CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        market TEXT NOT NULL,
        kind TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        evidence TEXT,
        suggestion TEXT NOT NULL DEFAULT '',
        fixable INTEGER NOT NULL DEFAULT 0,
        rule_id TEXT,
        source_url TEXT,
        source_title TEXT,
        quote TEXT,
        fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        note TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      version: 3,
      name: "create-rewrites",
      sql: `CREATE TABLE IF NOT EXISTS rewrites (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        owner_email TEXT NOT NULL DEFAULT 'local@localhost',
        issue_ids_json TEXT NOT NULL DEFAULT '[]',
        before_title TEXT NOT NULL,
        before_description TEXT NOT NULL DEFAULT '',
        after_title TEXT NOT NULL,
        after_description TEXT NOT NULL DEFAULT '',
        rationale TEXT NOT NULL DEFAULT '',
        changes_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'proposed',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    {
      version: 4,
      name: "compliance-indexes",
      sql: `CREATE INDEX IF NOT EXISTS idx_issues_owner_listing ON issues (owner_email, listing_id, sort_order)`,
    },
    {
      version: 5,
      name: "listings-index",
      sql: `CREATE INDEX IF NOT EXISTS idx_listings_owner_updated ON listings (owner_email, updated_at)`,
    },
  ],
  { table: "compliance_migrations" },
);
