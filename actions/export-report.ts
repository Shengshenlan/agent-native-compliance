import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { MARKET_ZH } from "../server/compliance/analyze.js";
import { listingDetail } from "../server/compliance/store.js";
import { guarded, ownerOf } from "./lib/guard.js";

const SEV = { high: "高", medium: "中", low: "低" } as Record<string, string>;
const ST = { open: "待处理", approved: "已确认", ignored: "已忽略", fixed: "已解决" } as Record<string, string>;

export default defineAction({
  description: "Export a listing's compliance review (verdicts, risk items with status, reviewer notes, cited sources) as Markdown.",
  schema: z.object({ listingId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ listingId }, ctx) =>
    guarded(async () => {
      const d = await listingDetail(ownerOf(ctx?.userEmail), listingId);
      const l = d.listing;
      const lines = [
        `# 出海合规审查：${l.title}`, "",
        `版本 v${l.version} · 知识库 ${l.kbVersion || "-"} · 检查时间 ${l.checkedAt || "-"}`, "",
        "## 各市场结论", "",
        ...l.summaries.map((s) => `- **${MARKET_ZH[s.market]}**：${s.label}（风险 ${s.risk.level}）— ${s.sentence}`), "",
        "## 风险项", "",
        "| 市场 | 等级 | 状态 | 风险项 | 建议 | 依据 |", "|---|---|---|---|---|---|",
        ...d.issues.map((i) => `| ${MARKET_ZH[i.market] || i.market} | ${SEV[i.severity]} | ${ST[i.status]} | ${i.title.replace(/\|/g, "/")}${i.note ? `<br>备注：${i.note.replace(/\|/g, "/")}` : ""} | ${i.suggestion.replace(/\|/g, "/").replace(/\n/g, " ")} | ${i.sourceUrl ? `[${(i.sourceTitle || i.ruleId || "来源").replace(/\|/g, "/")}](${i.sourceUrl})` : i.ruleId || (["brand", "counterfeit", "wording"].includes(i.kind) ? "品牌/仿冒词检测" : "通用文案风险")} |`), "",
        "> 本报告为合规预检，基于公开法规摘录的知识库自动匹配，不构成法律意见；上架前请向主管机构或认证代理核实。",
      ];
      return { markdown: lines.join("\n") };
    }),
});
