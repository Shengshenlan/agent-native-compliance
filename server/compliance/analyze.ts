// Contest-period code: turns the pre-existing sea-precheck Report (legacy/) into an
// editable, per-market risk board for the Agent-Native workbench.
import { buildReport, COUNTRY_ZH } from "../../legacy/sea-precheck/src/lib/core/match";
import { tierOf } from "../../legacy/sea-precheck/src/lib/core/plain";
import { summarize } from "../../legacy/sea-precheck/src/lib/core/verdict";
import { kb } from "../../legacy/sea-precheck/src/lib/core/kb";
import type { Category, Country, Platform, Report, RuleHit } from "../../legacy/sea-precheck/src/lib/core/types";

export const MARKETS = ["TH", "PH", "MY"] as const;
export type Market = (typeof MARKETS)[number];
export const MARKET_ZH: Record<string, string> = { ...COUNTRY_ZH, ALL: "所有市场" };
export const KB_VERSION = kb.version;

export type IssueKind = "prohibited" | "counterfeit" | "brand" | "wording" | "claim" | "cert" | "cert_maybe" | "display" | "platform" | "customs" | "review";
export type Severity = "high" | "medium" | "low";

export interface IssueDraft {
  market: Market | "ALL";
  kind: IssueKind;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string | null;
  suggestion: string;
  fixable: boolean;
  ruleId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  quote: string | null;
  fingerprint: string;
}

export interface MarketSummary {
  market: Market;
  verdict: string;
  label: string;
  sentence: string;
  headline: string;
  risk: Report["risk"];
  mustCerts: string[];
}

export interface AnalyzeInput { title: string; description?: string; category?: Category | "auto"; platform?: Platform | "" }

/**
 * Generic marketing-claim lint (contest-period addition). These are NOT in the cited KB;
 * they are flagged as "待复核" wording risks with no regulation citation.
 */
const CLAIM_TERMS: { term: RegExp; label: string }[] = [
  { term: /全网最低|史上最低|最低价/i, label: "绝对化价格宣称" },
  { term: /最好|最强|最佳|最安全|第一品牌|销量第一|No\.?\s?1\b/i, label: "绝对化用语" },
  { term: /100\s?%\s?(安全|有效|无害)|100% safe|guaranteed/i, label: "无法证实的保证" },
  { term: /无副作用|零风险|零伤害|永不损坏|永久有效/i, label: "无法证实的安全/寿命宣称" },
  { term: /医用级|医疗级|FDA\s?(approved|认证|批准)|国家级认证/i, label: "未附证明的资质宣称" },
];

const sevOfRule = (h: RuleHit): Severity => (h.rule.kind === "cert" && h.rule.mandatory ? (tierOf(h) === "must" ? "high" : "medium") : h.rule.kind === "display" ? "medium" : "low");
const firstExcerpt = (h: RuleHit) => h.rule.excerpts?.[0];
const clip = (s: string | undefined | null, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);

function ruleIssue(m: Market, h: RuleHit, kindOverride?: IssueKind): IssueDraft {
  // rules that apply to every market (UN38.3, platform IP policies...) become one "ALL" item
  const market: Market | "ALL" = h.rule.country === "ALL" ? "ALL" : m;
  const ex = firstExcerpt(h);
  const isCert = h.rule.kind === "cert" || h.rule.kind === "review";
  const kind: IssueKind = kindOverride ?? (isCert ? (tierOf(h) === "must" && h.rule.mandatory ? "cert" : "cert_maybe") : (h.rule.kind as IssueKind));
  const fixable = kind === "display";
  const steps = h.rule.next_steps.slice(0, 2).join("；");
  return {
    market, kind, severity: kindOverride === "cert_maybe" ? "medium" : sevOfRule(h),
    title: h.title || h.rule.title,
    detail: `${h.rule.requirement}${h.reason ? `（命中原因：${h.reason}）` : ""}${h.tier_reason ? `；${h.tier_reason}` : ""}`,
    evidence: null,
    suggestion: fixable
      ? `在 listing 描述中补充该要求对应的信息（如认证编号、当地语言标签说明），真实编号由卖家填写。${steps ? `参考：${steps}` : ""}`
      : steps || `向 ${h.rule.verify_with || h.rule.authority} 核实`,
    fixable,
    ruleId: h.rule.id, sourceUrl: ex?.source_url || null, sourceTitle: ex?.source_title || null, quote: clip(ex?.text, 400),
    fingerprint: `${market}:${kind}:${h.rule.id}`,
  };
}

/** Run the legacy matcher for each market and flatten everything into board items. */
export function analyzeListing(input: AnalyzeInput, markets: readonly Market[]) {
  const issues: IssueDraft[] = [];
  const summaries: MarketSummary[] = [];
  const seen = new Set<string>();
  const push = (i: IssueDraft) => { if (!seen.has(i.fingerprint)) { seen.add(i.fingerprint); issues.push(i); } };
  const text = `${input.title}\n${input.description || ""}`;
  let category: Category | null = null;

  for (const market of markets) {
    const r = buildReport({ title: input.title, description: input.description || "", category: input.category || "auto", country: market as Country, ...(input.platform ? { platform: input.platform } : {}) });
    category = category ?? r.category;
    const s = summarize(r);
    summaries.push({ market, verdict: s.verdict, label: s.label, sentence: s.sentence, headline: r.conclusion.headline, risk: r.risk, mustCerts: s.certs.map((c) => c.name) });

    if (r.conclusion.verdict === "prohibited")
      push({ market, kind: "prohibited", severity: "high", title: `${COUNTRY_ZH[market]}禁售品类`, detail: r.conclusion.headline, evidence: null, suggestion: "不要在该市场上架；改写文案无法解决。", fixable: false, ruleId: null, sourceUrl: null, sourceTitle: null, quote: null, fingerprint: `${market}:prohibited` });

    // brand / counterfeit / compat wording is market-independent -> one "ALL" item
    for (const b of r.brand.hits) {
      const kind: IssueKind = b.type === "counterfeit" ? "counterfeit" : b.type === "brand" ? "brand" : "wording";
      push({
        market: "ALL", kind, severity: kind === "wording" ? "medium" : "high",
        title: kind === "counterfeit" ? `仿冒暗示词「${b.term}」` : kind === "brand" ? `他人品牌词「${b.term}」（${b.brand}）` : `${b.type === "dupe" ? "平替/类似" : "兼容"}类措辞「${b.term}」`,
        detail: kind === "counterfeit" ? "平台普遍将此类词直接判为假货，可能下架/封店。" : kind === "brand" ? "未经授权在标题/描述中使用他人商标，侵权投诉风险高。" : "“兼容/适用于/平替”描述需避免暗示与品牌方存在关联。",
        evidence: b.term,
        suggestion: kind === "counterfeit" ? `删除「${b.term}」，改为描述商品本身的材质/功能。` : kind === "brand" ? `删除品牌词「${b.term}」，或在取得授权后保留并备好授权书。` : `改为“可用于 XX 型号（非原厂配件，与品牌方无关联）”这类中性表述。`,
        fixable: true, ruleId: null, sourceUrl: null, sourceTitle: null, quote: null,
        fingerprint: `ALL:${kind}:${b.term.toLowerCase()}`,
      });
    }
    for (const h of r.certs) push(ruleIssue(market, h));
    for (const h of r.display) push(ruleIssue(market, h));
    for (const h of r.platform) push(ruleIssue(market, h));
    for (const h of r.customs) push(ruleIssue(market, h));
    for (const v of r.review) {
      if (v.rule_id && !v.text.startsWith("出现功效/成分敏感词")) continue; // already folded into that rule's card
      const claim = v.text.startsWith("出现功效/成分敏感词");
      const h = v.rule_id ? [...r.certs, ...r.display].find((x) => x.rule.id === v.rule_id) : undefined;
      const ex = h ? firstExcerpt(h) : undefined;
      push({
        market, kind: claim ? "claim" : "review", severity: claim ? "medium" : "low",
        title: v.text, detail: v.reason, evidence: claim ? v.text.replace(/^出现功效\/成分敏感词：/, "") : null,
        suggestion: claim ? "删除美白/祛斑/治疗/药用等功效或违禁成分宣称，改为“保湿/提亮肤色观感”等普通化妆品可用表述，并以备案信息为准。" : `建议向 ${v.verify_with || "主管机构"} 核实`,
        fixable: claim, ruleId: v.rule_id || null, sourceUrl: ex?.source_url || null, sourceTitle: ex?.source_title || null, quote: clip(ex?.text, 400),
        fingerprint: `${market}:${claim ? "claim" : "review"}:${v.text}`,
      });
    }
  }
  for (const c of CLAIM_TERMS) {
    const m = text.match(c.term);
    if (m) push({
      market: "ALL", kind: "claim", severity: "low", title: `${c.label}「${m[0]}」`,
      detail: "平台广告/商品展示规范通常禁止无法证实的绝对化或保证性宣称（通用文案风险，知识库未收录对应法规条款，需人工复核）。",
      evidence: m[0], suggestion: "改为可证实、可量化的客观描述（如具体参数、检测报告编号）。", fixable: true,
      ruleId: null, sourceUrl: null, sourceTitle: null, quote: null, fingerprint: `ALL:claim:${m[0].toLowerCase()}`,
    });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || +b.fixable - +a.fixable);
  return { issues, summaries, category, kbVersion: kb.version };
}
