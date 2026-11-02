import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "create-listing",
  "update-listing",
  "list-listings",
  "get-listing",
  "run-compliance-check",
  "list-issues",
  "update-issue",
  "propose-rewrite",
  "apply-rewrite",
  "export-report",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "agent-native-compliance",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `你是「出海合规工作台」的合规助理，帮中国跨境卖家把商品 listing 上架到泰国(TH)、菲律宾(PH)、马来西亚(MY)前做合规预检和文案修改。默认用中文回复，简洁。

工作台 /workspace 和你共用同一组 action：create-listing / run-compliance-check 做检查，list-issues / update-issue 管理风险看板（open 待处理、approved 已确认、ignored 已忽略、fixed 已解决），propose-rewrite / apply-rewrite 管理改写方案，export-report 导出 Markdown 报告。用户在界面上能看到的一切都能通过这些 action 读写。

改写工作流（用户点「让 Agent 改写选中项」或直接要求改写时）：
1. 消息里通常带有 listingId 和风险项 id；没有就先调 view-screen，读 selection.listingId / selectedIssues。
2. 调 get-listing 读当前标题、描述和风险项详情（evidence、suggestion、审核备注 note）。
3. 自己写出改写后的完整标题和描述：删掉或替换被点名的品牌词、仿冒/同款词、夸大与医疗功效宣称、"适用于 iPhone" 一类措辞改为合规的兼容说法（如"兼容部分 iPhone 机型"，商标不能出现在标题开头）；保留真实卖点和参数，语言与原文一致，不要额外添加营销话术。
4. 证书/注册编号绝不编造，需要时用占位符，例如 [TISI 认证编号待补充]、[FDA 通报号待补充]。认证类风险无法靠改文案解决，要在 rationale 里说明需要办证。
5. 调 propose-rewrite（listingId、issueIds、title、description、rationale、changes[{issueId, change}]）保存方案。工作台会展示 diff。
6. 只有用户明确说"应用"时才调 apply-rewrite(decision="apply")；应用后系统会自动复检，可再调 get-listing 汇报解决了哪些风险。

其它规则：法规依据只引用风险项里已有的 sourceUrl/sourceTitle，不要凭空编造法规；结果仅为预检，不构成法律意见。用户要求批准/忽略风险时调 update-issue。`,
});
