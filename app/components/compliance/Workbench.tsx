// Contest-period code: 出海合规工作台 main screen.
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction, useActionMutation, useActionQuery, writeClientAppState } from "@agent-native/core/client/hooks";
import { IconTrash, IconCheck, IconEye, IconEyeOff, IconFileExport, IconLoader2, IconPencil, IconPlus, IconRefresh, IconSparkles, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TAB_ID } from "@/lib/tab-id";

import { DiffView } from "./DiffView";
import { CATEGORY_OPTIONS, KIND_ZH, MARKET_FLAG, MARKET_ZH, SAMPLES, SEVERITY_ZH, STATUS_ZH, type IssueView, type ListingView, type RewriteView } from "./types";

type ListingRow = ListingView & { openIssues: number; highOpen: number; totalIssues: number };
type Detail = { listing: ListingView; issues: IssueView[]; pendingRewrite: RewriteView | null; history: Omit<RewriteView, "titleDiff" | "descriptionDiff">[] };

const sevClass: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const riskClass: Record<string, string> = { 高: "text-red-600", 中: "text-amber-600", 低: "text-emerald-600", 待复核: "text-slate-500" };
const statusClass: Record<string, string> = {
  open: "border-sky-300 text-sky-700 dark:text-sky-300", approved: "border-violet-300 text-violet-700 dark:text-violet-300",
  ignored: "border-slate-300 text-slate-500", fixed: "border-emerald-300 text-emerald-700 dark:text-emerald-300",
};

export default function Workbench() {
  const [params, setParams] = useSearchParams();
  const listingId = params.get("listing") || "";
  const listingsQ = useActionQuery("list-listings", {}, { refetchInterval: 5000 });
  const listings = ((listingsQ.data as { listings?: ListingRow[] } | undefined)?.listings ?? []) as ListingRow[];

  useEffect(() => {
    if (!listingId && listings[0]) setParams({ listing: listings[0].id }, { replace: true });
  }, [listingId, listings, setParams]);

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4">
        <NewListingForm onCreated={(id) => setParams({ listing: id })} />
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">商品列表</div>
          {listings.length === 0 && <p className="text-sm text-muted-foreground">还没有商品，先在上面粘贴一条 listing。</p>}
          <ul className="space-y-1.5">
            {listings.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setParams({ listing: l.id })}
                  className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent", l.id === listingId ? "border-primary bg-accent" : "border-border")}
                >
                  <div className="line-clamp-2 font-medium">{l.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>v{l.version}</span>
                    {l.summaries.map((s) => (
                      <span key={s.market} className={riskClass[s.risk.level]}>{MARKET_FLAG[s.market]} {s.risk.level}</span>
                    ))}
                    <span>· 待处理 {l.openIssues}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto">
        {listingId ? <ListingPanel key={listingId} listingId={listingId} /> : <EmptyState />}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
      <div className="text-lg font-semibold text-foreground">出海合规工作台</div>
      <p className="max-w-md text-sm">粘贴商品标题和描述，一次检查泰国 / 菲律宾 / 马来西亚的强制认证、标签、平台禁限与品牌侵权风险；在风险看板上逐条确认，再让 Agent 按选中的风险改写文案。</p>
    </div>
  );
}

function NewListingForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("auto");
  const [markets, setMarkets] = useState<string[]>(["TH", "PH", "MY"]);
  const [error, setError] = useState("");
  const create = useActionMutation("create-listing");
  const submit = async () => {
    setError("");
    if (!title.trim()) return setError("请填写商品标题");
    if (!markets.length) return setError("至少选择一个市场");
    try {
      const res = (await create.mutateAsync({ title, description, category: category as never, markets: markets as never, runCheck: true })) as { listing: ListingView };
      setTitle(""); setDescription("");
      onCreated(res.listing.id);
    } catch (e) { setError(actionErrorMessage(e) ?? "操作失败"); }
  };
  return (
    <div className="space-y-2.5" data-testid="new-listing">
      <div className="text-sm font-semibold">新建检查</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="商品标题" maxLength={200} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="商品描述 / 卖点（可选）" rows={4} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      <div className="flex items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex gap-3 text-sm">
        {["TH", "PH", "MY"].map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={markets.includes(m)} onChange={(e) => setMarkets(e.target.checked ? [...markets, m] : markets.filter((x) => x !== m))} />
            {MARKET_FLAG[m]} {MARKET_ZH[m]}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button className="w-full" onClick={submit} disabled={create.isPending}>
        {create.isPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />} 检查 TH / PH / MY 合规
      </Button>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground">示例：</span>
        {SAMPLES.map((s) => (
          <button key={s.label} onClick={() => { setTitle(s.title); setDescription(s.description); setCategory(s.category); }} className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent">{s.label}</button>
        ))}
      </div>
    </div>
  );
}

function ListingPanel({ listingId }: { listingId: string }) {
  const [waitingAgent, setWaitingAgent] = useState(false);
  const q = useActionQuery("get-listing", { listingId }, { refetchInterval: waitingAgent ? 2500 : 8000 });
  const d = q.data as Detail | undefined;
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [marketFilter, setMarketFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const update = useActionMutation("update-issue");
  const recheck = useActionMutation("run-compliance-check");
  const decide = useActionMutation("apply-rewrite");
  const del = useActionMutation("delete-listing");
  const [, setParams] = useSearchParams();

  const issues = d?.issues ?? [];
  const visible = useMemo(() => issues.filter((i) => (statusFilter === "active" ? i.status === "open" || i.status === "approved" : statusFilter ? i.status === statusFilter : true) && (!marketFilter || i.market === marketFilter)), [issues, statusFilter, marketFilter]);
  const selectedIssues = issues.filter((i) => selected.has(i.id));

  // share board selection with the agent (view-screen reads it)
  useEffect(() => {
    const value = { listingId, issueIds: [...selected] };
    void writeClientAppState(`selection:${TAB_ID}`, value, { requestSource: TAB_ID } as never).catch(() => {});
    void writeClientAppState("selection", value, { requestSource: TAB_ID } as never).catch(() => {});
  }, [listingId, selected]);
  useEffect(() => { if (d?.pendingRewrite) setWaitingAgent(false); }, [d?.pendingRewrite?.id]);

  if (q.isLoading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><IconLoader2 className="size-4 animate-spin" />加载中…</div>;
  if (q.error || !d) return <div className="p-8 text-sm text-red-600">{q.error ? (actionErrorMessage(q.error) ?? "加载失败") : "未找到该商品"}</div>;
  const l = d.listing;

  const setStatus = async (ids: string[], status: string, note?: string) => {
    try { await update.mutateAsync({ ids, status: status as never, ...(note ? { note } : {}) }); setMsg(`已将 ${ids.length} 项标记为「${STATUS_ZH[status]}」`); }
    catch (e) { setMsg(actionErrorMessage(e) ?? "操作失败"); }
  };
  const askAgent = () => {
    const pick = selectedIssues.length ? selectedIssues : issues.filter((i) => i.fixable && (i.status === "open" || i.status === "approved"));
    if (!pick.length) return setMsg("请先在看板上勾选要改写解决的风险项");
    const lines = pick.map((i) => `- [${i.id}] (${MARKET_ZH[i.market]}/${KIND_ZH[i.kind]}) ${i.title}${i.evidence ? ` ｜原文：${i.evidence}` : ""} ｜建议：${i.suggestion}${i.note ? ` ｜审核备注：${i.note}` : ""}`);
    sendToAgentChat({
      message: `请按下列风险项改写商品「${l.title}」的标题和描述，然后调用 propose-rewrite 保存改写方案（listingId=${l.id}，issueIds 用下面方括号里的 id），我会在工作台查看 diff 后再决定是否应用。\n\n${lines.join("\n")}`,
      context: `listingId: ${l.id}\n当前标题: ${l.title}\n当前描述: ${l.description}`,
      contextLabel: "当前商品",
      submit: true,
      openSidebar: true,
    });
    setWaitingAgent(true);
    setMsg(`已把 ${pick.length} 个风险项交给 Agent 改写，生成后会在下方显示 diff`);
  };
  const exportMd = async () => {
    const r = (await callAction("export-report", { listingId })) as { markdown: string };
    const url = URL.createObjectURL(new Blob([r.markdown], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `合规审查-${l.title.slice(0, 20)}.md`; a.click(); URL.revokeObjectURL(url);
  };

  const counts = { open: issues.filter((i) => i.status === "open").length, approved: issues.filter((i) => i.status === "approved").length, ignored: issues.filter((i) => i.status === "ignored").length, fixed: issues.filter((i) => i.status === "fixed").length };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">v{l.version} · 知识库 {l.kbVersion} · 检查于 {l.checkedAt ? new Date(l.checkedAt).toLocaleString("zh-CN") : "-"}</div>
          <h1 className="mt-1 text-xl font-semibold" data-testid="listing-title">{l.title}</h1>
          {l.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => recheck.mutate({ listingId })} disabled={recheck.isPending}>
            {recheck.isPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}重新检查
          </Button>
          <Button variant="outline" size="sm" onClick={exportMd}><IconFileExport className="size-4" />导出报告</Button>
          <Button variant="ghost" size="icon-sm" title="删除商品" onClick={async () => { if (!window.confirm("删除该商品及其风险看板？")) return; await del.mutateAsync({ listingId }); setParams({}); }}><IconTrash className="size-4" /></Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3" data-testid="verdicts">
        {l.summaries.map((s) => (
          <div key={s.market} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{MARKET_FLAG[s.market]} {MARKET_ZH[s.market]}</div>
              <div className={cn("text-sm font-semibold", riskClass[s.risk.level])}>风险 {s.risk.level}</div>
            </div>
            <div className="mt-1 text-sm font-medium">{s.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.headline || s.sentence}</p>
            {s.mustCerts.length > 0 && <ul className="mt-2 space-y-0.5 text-xs">{s.mustCerts.map((c) => <li key={c}>• {c}</li>)}</ul>}
          </div>
        ))}
      </div>

      {d.pendingRewrite && <RewritePanel rw={d.pendingRewrite} issues={issues} busy={decide.isPending} onDecide={async (decision) => { try { await decide.mutateAsync({ rewriteId: d.pendingRewrite!.id, decision }); setSelected(new Set()); setMsg(decision === "apply" ? "已应用改写并重新检查" : "已放弃该改写"); } catch (e) { setMsg(actionErrorMessage(e) ?? "操作失败"); } }} />}
      {waitingAgent && !d.pendingRewrite && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm"><IconLoader2 className="size-4 animate-spin" />Agent 正在改写… 右侧对话中可以看到过程，完成后 diff 会出现在这里。<button className="ml-auto text-xs underline" onClick={() => setWaitingAgent(false)}>不再等待</button></div>
      )}

      <div className="rounded-xl border border-border" data-testid="risk-board">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="mr-2 font-semibold">风险看板</div>
          {[["active", `待处理+已确认 ${counts.open + counts.approved}`], ["open", `待处理 ${counts.open}`], ["approved", `已确认 ${counts.approved}`], ["ignored", `已忽略 ${counts.ignored}`], ["fixed", `已解决 ${counts.fixed}`], ["", `全部 ${issues.length}`]].map(([v, label]) => (
            <button key={v} onClick={() => setStatusFilter(v)} className={cn("rounded-full px-2.5 py-1 text-xs", statusFilter === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}>{label}</button>
          ))}
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-xs">
            <option value="">全部市场</option>
            {["ALL", ...l.markets].map((m) => <option key={m} value={m}>{MARKET_FLAG[m]} {MARKET_ZH[m]}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-sm">
          <span className="text-muted-foreground">已选 {selected.size} 项</span>
          <Button size="xs" variant="outline" onClick={() => setSelected(new Set(visible.filter((i) => i.fixable && i.status !== "fixed").map((i) => i.id)))}>选中所有可改写项</Button>
          <Button size="xs" variant="outline" disabled={!selected.size} onClick={() => setStatus([...selected], "approved")}><IconCheck className="size-3.5" />批量确认</Button>
          <Button size="xs" variant="outline" disabled={!selected.size} onClick={() => setStatus([...selected], "ignored")}><IconEyeOff className="size-3.5" />批量忽略</Button>
          <Button size="sm" className="ml-auto" onClick={askAgent} data-testid="ask-agent"><IconSparkles className="size-4" />让 Agent 改写选中项</Button>
        </div>
        {msg && <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{msg}</div>}
        <ul className="divide-y divide-border">
          {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">没有符合筛选条件的风险项</li>}
          {visible.map((i) => (
            <li key={i.id} className={cn("flex gap-3 px-4 py-3", selected.has(i.id) && "bg-primary/5", i.status === "ignored" && "opacity-60")}>
              <input type="checkbox" className="mt-1" checked={selected.has(i.id)} onChange={(e) => { const n = new Set(selected); e.target.checked ? n.add(i.id) : n.delete(i.id); setSelected(n); }} aria-label="选择风险项" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={cn("rounded px-1.5 py-0.5 font-medium", sevClass[i.severity])}>{SEVERITY_ZH[i.severity]}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">{MARKET_FLAG[i.market]} {MARKET_ZH[i.market]}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">{KIND_ZH[i.kind] || i.kind}</span>
                  {i.fixable && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">可改写</span>}
                  <span className={cn("rounded border px-1.5 py-0.5", statusClass[i.status])}>{STATUS_ZH[i.status]}</span>
                  {i.ruleId && <span className="font-mono text-muted-foreground">{i.ruleId}</span>}
                </div>
                {editing === i.id ? (
                  <IssueEditor issue={i} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <div className="mt-1 text-sm font-medium">{i.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{i.detail}</div>
                    <div className="mt-1 text-xs"><span className="text-muted-foreground">建议：</span>{i.suggestion}</div>
                    {i.note && <div className="mt-1 text-xs text-violet-700 dark:text-violet-300">审核备注：{i.note}</div>}
                    {i.sourceUrl && <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-700 underline dark:text-sky-300">依据：{i.sourceTitle || i.ruleId}</a>}
                  </>
                )}
              </div>
              {editing !== i.id && (
                <div className="flex shrink-0 items-start gap-1">
                  {i.status !== "approved" && i.status !== "fixed" && <Button size="icon-sm" variant="ghost" title="确认" onClick={() => setStatus([i.id], "approved")}><IconCheck className="size-4" /></Button>}
                  {i.status !== "ignored" && i.status !== "fixed" && <Button size="icon-sm" variant="ghost" title="忽略（误报/不适用）" onClick={() => setStatus([i.id], "ignored")}><IconEyeOff className="size-4" /></Button>}
                  {(i.status === "ignored" || i.status === "approved") && <Button size="icon-sm" variant="ghost" title="重新打开" onClick={() => setStatus([i.id], "open")}><IconEye className="size-4" /></Button>}
                  <Button size="icon-sm" variant="ghost" title="编辑" onClick={() => setEditing(i.id)}><IconPencil className="size-4" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">合规预检结果基于公开法规摘录的知识库自动匹配，不构成法律意见；上架前请向主管机构或认证代理核实。</p>
    </div>
  );
}

function IssueEditor({ issue, onDone }: { issue: IssueView; onDone: () => void }) {
  const [title, setTitle] = useState(issue.title);
  const [suggestion, setSuggestion] = useState(issue.suggestion);
  const [note, setNote] = useState(issue.note);
  const [severity, setSeverity] = useState(issue.severity);
  const update = useActionMutation("update-issue");
  const save = async () => { await update.mutateAsync({ ids: [issue.id], title, suggestion, note, severity: severity as never }); onDone(); };
  return (
    <div className="mt-2 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="改写/处理建议" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="审核备注（会一并交给 Agent）" />
      <div className="flex items-center gap-2">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
          {["high", "medium", "low"].map((s) => <option key={s} value={s}>风险 {SEVERITY_ZH[s]}</option>)}
        </select>
        <Button size="xs" onClick={save} disabled={update.isPending}>保存</Button>
        <Button size="xs" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </div>
  );
}

function RewritePanel({ rw, issues, busy, onDecide }: { rw: RewriteView; issues: IssueView[]; busy: boolean; onDecide: (d: "apply" | "discard") => void }) {
  const byId = new Map(issues.map((i) => [i.id, i]));
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4" data-testid="rewrite-panel">
      <div className="flex items-center gap-2">
        <IconSparkles className="size-4 text-primary" />
        <div className="font-semibold">Agent 改写方案</div>
        <span className="text-xs text-muted-foreground">针对 {rw.issueIds.length} 个风险项 · +{rw.stats.added} / −{rw.stats.removed} 字</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onDecide("discard")} disabled={busy}><IconX className="size-4" />放弃</Button>
          <Button size="sm" onClick={() => onDecide("apply")} disabled={busy} data-testid="apply-rewrite">{busy ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}应用并重新检查</Button>
        </div>
      </div>
      <div className="mt-3 space-y-3 rounded-lg bg-background p-3 text-sm">
        <div><div className="mb-1 text-xs text-muted-foreground">标题</div><DiffView ops={rw.titleDiff} /></div>
        <div><div className="mb-1 text-xs text-muted-foreground">描述</div><DiffView ops={rw.descriptionDiff} /></div>
      </div>
      {rw.rationale && <p className="mt-3 text-xs text-muted-foreground">{rw.rationale}</p>}
      {rw.changes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {rw.changes.map((c, k) => <li key={k}>• {c.issueId && byId.get(c.issueId) ? <span className="text-muted-foreground">[{byId.get(c.issueId)!.title}] </span> : null}{c.change}</li>)}
        </ul>
      )}
    </div>
  );
}
