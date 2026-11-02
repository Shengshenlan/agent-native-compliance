# legacy/sea-precheck — 赛前已有代码（原样复制，未修改）

本目录是作者赛前项目「出海合规雷达」（sea-precheck）的规则库与确定性检查逻辑，**在本次黑客松（2026-10-27 之后）之前已存在**，按原样复制进来复用：

- `src/lib/core/*.ts` — 品类/特征识别、品牌/仿牌词检测、规则匹配（`buildReport`）、风险等级与结论（`verdict.ts`）、引用校验等
- `kb/rules.json` — 知识库 66 条规则（版本 2026.10.23-3，TH/PH/MY + 通用），每条附官方原文摘录与来源链接
- `kb/README.md` — 知识库说明

来源提交见 `SOURCE_COMMIT`，文件哈希见 `SHA256SUMS`（可用 `sha256sum -c SHA256SUMS` 验证未改动）。
原项目的快照原文（`kb/snapshots/`）、Worker、前端、账号系统均**未**复制。

时间证据（sea-precheck 仓库 git 记录，UTC）：`src/lib/core` 与 `kb/rules.json` 首次提交 2026-10-23T05:58Z，最后一次修改 2026-10-24T03:33Z，均早于比赛开发期（2026-10-27 起）。复制时 sea-precheck HEAD 为 `a6595a1`。
