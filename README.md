# 出海合规工作台 · SEA Listing Compliance Workbench

An **agent-native** workbench for Chinese cross-border sellers who list products in **Thailand, the Philippines and Malaysia**. Paste a product listing. The app checks it against a cited rule base covering mandatory certification, labelling, platform bans, brand and counterfeit wording, and logistics. A human reviews the findings on a **risk board**. Then you **select risk items and have the agent rewrite the listing**, and the result comes back as a reviewable **diff** you can apply or discard.

Built for the Builder.io Agent-Native Hackathon (development period starting 2026-10-27) on `@agent-native/core` 0.222.2 (chat template).

![risk board](screenshots/03-risk-board-after-check.png)

## What makes it agent-native

Every capability is a `defineAction` in `actions/`. The **same actions** serve the UI (`useActionQuery` / `useActionMutation`), the agent (as tools), HTTP (`/_agent-native/actions/<name>`) and the CLI.

| Action | Used by UI | Used by agent | What it does |
|---|---|---|---|
| `create-listing` | ✅ new-listing form | ✅ | Save a listing and run the check |
| `update-listing` / `delete-listing` | ✅ (delete) | ✅ | Edit text, category or markets / delete |
| `list-listings` / `get-listing` | ✅ | ✅ | Listings plus per-market verdicts, board items and pending rewrite with diff |
| `run-compliance-check` | ✅ 重新检查 | ✅ | Deterministic check. On re-check it merges by fingerprint, keeps human edits and marks vanished items as `fixed` |
| `list-issues` / `update-issue` | ✅ approve / ignore / reopen / inline edit / bulk | ✅ | Board items `open → approved / ignored / fixed`, plus note, severity and suggestion |
| `propose-rewrite` | (shows the result) | ✅ | The agent saves its rewritten title and description, with rationale and per-issue changes |
| `quick-rewrite` | ✅ ⚡ 快速改写（直连 LLM） | ✅ | **Fast lane**: one direct LLM completion (no agent tool loop, thinking off) → saved through the same `proposeRewrite` path, so it lands in the same diff / apply flow |
| `apply-rewrite` | ✅ 应用 / 放弃 | ✅ when the user asks | Apply (updates the listing and re-checks) or discard |
| `export-report` | ✅ 导出报告 | ✅ | Markdown audit report |
| `view-screen` | — | ✅ | Current listing plus the board **selection** (`{listingId, issueIds}`, written per browser tab) |

**Human ↔ agent loop:**
1. Check the listing.
2. Approve or ignore items and add reviewer notes on the board.
3. Tick the items to fix, then click **「让 Agent 改写选中项」**.
4. The agent sidebar opens and receives the listing id and the selected items. It calls `get-listing`, writes the new copy and calls `propose-rewrite`.
5. The workbench shows the red/green token diff.
6. **Apply** reruns the check, and resolved items move to 已解决 (resolved).

The agent is told never to invent certificate numbers. It inserts placeholders such as `[TISI 认证编号待补充]` instead.

### ⚡ Fast lane vs. agent chat

The agent-chat path is the most flexible (you can follow up, ask why, ask for a different tone) but takes several model rounds (`view-screen` → `get-listing` → write → `propose-rewrite`). For the common case — "fix these ticked items" — the board also has **「⚡ 快速改写（直连 LLM）」**, which calls the `quick-rewrite` action:

- **1 round**: one `/chat/completions` call with the listing + selected items as JSON, same rules (no invented cert numbers, placeholders, neutral compatibility wording), JSON output.
- `reasoning_effort: "none"` is sent to the OpenAI-compatible endpoint. With thinking on, GLM spent ~1.2–1.5k reasoning tokens before writing (measured 39.7 s vs 7.0 s on a 4-item prompt).
- The key comes from the framework's credential resolver (`getOwnerApiKeyForEngine`, deployment fallback); it is never logged or echoed. Other engines fall back to the framework's `completeText()`.
- Result is saved as a normal pending proposal (`propose-rewrite` lifecycle), labelled 「⚡ 快通道改写方案」 with the measured time in the rationale.

Measured on the demo power-bank listing, 10 selected items, `glm-5.3-flash` (2026-11-01):

| Path | Model rounds | Time to diff on screen |
|---|---|---|
| ⚡ `quick-rewrite` (curl, 3 runs) | 1 | 14.1 s / 15.8 s / 15.9 s |
| ⚡ `quick-rewrite` (UI click → diff, Playwright, 2 runs) | 1 | 18.6 s / 16.6 s |
| Agent chat (UI click → diff, Playwright, same 2 runs) | 4+ | 93.6 s / 258.6 s |

## Pre-existing code vs. code written during the hackathon

| Path | Origin | Notes |
|---|---|---|
| `legacy/sea-precheck/src/lib/core/*.ts`, `src/lib/text.ts`, `kb/rules.json`, `kb/README.md` | **Pre-existing** (author's earlier project 「出海合规雷达」/sea-precheck, commit `a6595a1`; files last modified 2026-10-24) | Copied **unchanged**: rule KB (66 cited rules, v2026.10.23-3), category/feature detection, brand/counterfeit detection, `buildReport`, verdicts. Verify with `cd legacy/sea-precheck && sha256sum -c SHA256SUMS` |
| Agent-Native chat template (`app/` shell, `server/` plugins, config) | **Template** (`@agent-native/core` 0.222.2) | Scaffolded and then modified (sidebar link, navigation view, home path, agent prompt and tools) |
| `server/compliance/analyze.ts` | **Hackathon** | Maps the legacy per-market `Report` to board items (dedup across markets, kinds, fixable flag). Adds a generic exaggerated-claim lint (uncited, flagged for review) |
| `server/compliance/diff.ts` | **Hackathon** | CJK/Thai-aware token LCS diff |
| `server/compliance/store.ts`, `server/db/*` | **Hackathon** | Listings, issues and rewrites tables, migrations, fingerprint merge on re-check, rewrite lifecycle |
| `actions/*` (except template `hello`, `navigate`, `run`, `provider-api-request`) | **Hackathon** | All compliance actions, plus `view-screen` extended with the board selection |
| `server/compliance/quick-rewrite.ts` | **Hackathon** | Fast-lane single-call rewrite |
| `app/components/compliance/*`, `app/routes/workspace.tsx` | **Hackathon** | Workbench UI: form, verdict cards, risk board, bulk bar, agent hand-off, fast lane, diff panel, export |
| `server/plugins/agent-chat.ts` prompt + tool list, `AGENTS.md` domain section | **Hackathon** | Chinese domain prompt and rewrite workflow |

Third-party: Agent-Native framework, React Router, Drizzle, PGlite, Tailwind, Tabler icons and zod. The LLM is Zhipu GLM (`glm-5.3-flash`) via its OpenAI-compatible API, and any OpenAI-compatible model works.

## Run locally

Requirements: Node ≥ 22.22 and pnpm (via corepack).

```bash
export COREPACK_HOME=$HOME/.cache/corepack   # only needed if corepack's default dir is read-only
pnpm install
cp .env.example .env        # then put your key in OPENAI_API_KEY (.env is gitignored)
pnpm dev                    # → http://localhost:8080/workspace
```

`.env` keys:
- `AUTH_DISABLED=true` for a local demo without login.
- `AGENT_ENGINE=ai-sdk:openai`, `AGENT_MODEL` and `OPENAI_BASE_URL` for the Zhipu OpenAI-compatible endpoint.
- `OPENAI_API_KEY`.

The data is stored locally in PGlite under `data/`. Without a key the check, board, diff and apply all still work; only the two rewrite paths (agent chat and ⚡ fast lane) need the LLM.

Checks: `pnpm typecheck`, `pnpm agent-native:doctor`.

## Screenshots (Playwright, headless Chrome)

| | |
|---|---|
| `01-workbench-empty.png` | Empty workbench |
| `02-new-listing-form.png` | Demo listing filled in (power bank with brand words, "同款" and "全网最低价") |
| `03-risk-board-after-check.png` | Per-market verdicts + risk board |
| `04-edit-issue-inline.png` | Inline edit of an item (reviewer note handed to the agent) |
| `05-select-fixable-items.png` | Selecting rewriteable items |
| `06-agent-rewriting-in-sidebar.png` | Agent sidebar working on the selected items |
| `07c-quick-rewrite-running.png` | ⚡ Fast lane running (live timer) |
| `07d-quick-rewrite-diff.png`, `07e-quick-rewrite-diff-detail.png` | Fast-lane proposal in the same diff panel (≈16 s) |
| `07-rewrite-diff.png`, `07b-rewrite-diff-detail.png` | Agent-chat proposal as a diff with rationale and per-issue changes |
| `08-after-apply-fixed-items.png` | After apply + automatic re-check: items moved to 已解决 |
| `09-exported-report.md` / `.png` | Exported Markdown report |

## Limitations

- The rule KB is a snapshot (v2026.10.23-3). Some sources are third-party or need JS, and the board labels those. Certification items cannot be fixed by rewriting copy. The agent explains that and leaves placeholders.
- The exaggerated-claim lint (`CLAIM_TERMS`) is a generic heuristic and has no regulation citation.
- Per-market cards: the label is recomposed in the hackathon layer (`composeVerdict` in `server/compliance/analyze.ts`) from the legacy verdict **plus** copy blockers (brand / counterfeit words, efficacy claims), e.g. 「改文案 + 办证后可上架」, and each card lists the copy fixes (✎) and certs (办理). The legacy `summarize()` is untouched; its raw output is kept as `legacyVerdict` / `legacyLabel`.
- Rewrites are LLM output: always review the diff. Either path can still introduce or keep a brand word; the automatic re-check after apply catches that and the card goes back to 「改文案…」.

**Disclaimer:** this is an automated pre-check based on excerpts of public regulations. It is not legal advice. Confirm with the authorities or a certification agent before listing.
