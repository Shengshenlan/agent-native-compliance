// Contest-period code: "fast lane" rewrite — one LLM completion (no tool loop), same proposal/diff flow.
import { completeText, getOwnerApiKeyForEngine, readDeployCredentialEnv } from "@agent-native/core/server";

import { MARKET_ZH } from "./analyze.js";
import { listIssues, proposeRewrite, requireListing } from "./store.js";

const SYSTEM = `你是跨境电商合规文案编辑。根据给定的风险项，改写商品标题和描述，使其在泰国/菲律宾/马来西亚上架时消除这些文案风险。
规则：
- 删除或替换被点名的他人品牌词、仿冒暗示词（同款/原单/高仿等）、夸大/绝对化/医疗功效宣称；"适用于 品牌" 改为"兼容部分 XX 机型（非原厂配件，与品牌方无关联）"这类中性表述，品牌名不得出现在标题中。
- 保留真实卖点、参数和原文语言；不要新增营销话术，不要新增原文没有的参数。
- 绝不编造证书/注册编号；如需提示认证信息，用占位符，如 [TISI 认证编号待补充]。认证类问题无法靠改文案解决，在 rationale 中说明。
- 只输出一个 JSON 对象，不要 markdown 代码块：{"title": string, "description": string, "rationale": string, "changes": [{"issueId": string, "change": string}]}`;

function extractJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error(`模型未返回 JSON（输出 ${t.length} 字）`);
  return JSON.parse(t.slice(a, b + 1));
}


type Once = { text: string; model: string; stopReason?: string; usage?: unknown; via: "direct" | "completeText" };

/**
 * One completion, as fast as possible.
 * - OpenAI-compatible deployment endpoint (e.g. GLM): call /chat/completions directly with
 *   reasoning_effort "none" — the framework drops the effort for model ids it does not know,
 *   and thinking-on GLM spends ~40s reasoning before writing ~300 tokens (measured 39.7s vs 7.0s).
 * - Anything else: framework completeText().
 * Key comes from the framework's owner/deployment resolver; it is never logged or echoed.
 */
async function completeOnce(ownerEmail: string, system: string, input: string): Promise<Once> {
  const engine = process.env.AGENT_ENGINE || "";
  const model = process.env.AGENT_MODEL || undefined;
  const baseUrl = readDeployCredentialEnv("OPENAI_BASE_URL");
  if (engine === "ai-sdk:openai" && baseUrl && model) {
    const { apiKey } = await getOwnerApiKeyForEngine(engine, ownerEmail, { allowDeploymentFallback: true });
    if (apiKey) {
      const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0.2, max_tokens: 3000, reasoning_effort: "none",
          messages: [{ role: "system", content: system }, { role: "user", content: input }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!r.ok) {
        let reason = `HTTP ${r.status}`;
        try { const j: any = await r.json(); if (typeof j?.error?.message === "string") reason += ` ${j.error.message.slice(0, 120)}`; } catch {}
        throw new Error(`模型调用失败（${reason}）`);
      }
      const j: any = await r.json();
      return { text: j?.choices?.[0]?.message?.content ?? "", model: j?.model || model, stopReason: j?.choices?.[0]?.finish_reason, usage: j?.usage, via: "direct" };
    }
  }
  const res = await completeText({ ...(model ? { model } : {}), appId: "agent-native-compliance", systemPrompt: system, input, temperature: 0.2, maxOutputTokens: 3000, reasoningEffort: "none", timeoutMs: 90_000 });
  return { text: res.text, model: res.model, stopReason: res.stopReason, usage: res.usage, via: "completeText" };
}

export async function quickRewrite(ownerEmail: string, listingId: string, issueIds: string[]) {
  const started = Date.now();
  const l = await requireListing(ownerEmail, listingId);
  const picked = await listIssues(ownerEmail, listingId, { ids: issueIds });
  if (!picked.length) throw new Error("没有找到选中的风险项");
  const input = JSON.stringify({
    title: l.title,
    description: l.description,
    issues: picked.map((i) => ({ id: i.id, market: MARKET_ZH[i.market] || i.market, kind: i.kind, title: i.title, evidence: i.evidence, suggestion: i.suggestion, reviewerNote: i.note || undefined })),
  });
  const res = await completeOnce(ownerEmail, SYSTEM, input);
  const llmMs = Date.now() - started;
  if (!res.text.trim()) throw new Error(`模型输出为空（stop=${res.stopReason ?? "?"}，可能输出预算被思考耗尽）`);
  const out = extractJson(res.text);
  if (typeof out?.title !== "string" || !out.title.trim()) throw new Error("模型返回缺少 title");
  const valid = new Set(picked.map((i) => i.id));
  const changes = Array.isArray(out.changes)
    ? out.changes.filter((c: any) => c && typeof c.change === "string" && c.change.trim()).map((c: any) => ({ ...(valid.has(c.issueId) ? { issueId: c.issueId } : {}), change: String(c.change).slice(0, 500) }))
    : [];
  const rewrite = await proposeRewrite(ownerEmail, {
    listingId, issueIds: picked.map((i) => i.id),
    title: out.title.slice(0, 200), description: typeof out.description === "string" ? out.description : l.description,
    rationale: `${typeof out.rationale === "string" ? out.rationale : ""}（快通道：单次模型调用 ${res.model}，${(llmMs / 1000).toFixed(1)}s）`.trim(),
    changes,
  });
  return { rewrite, model: res.model, via: res.via, llmMs, totalMs: Date.now() - started, usage: res.usage ?? null };
}
