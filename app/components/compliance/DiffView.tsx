import type { DiffOp } from "./types";

export function DiffView({ ops }: { ops: DiffOp[] }) {
  if (!ops.length) return <span className="text-muted-foreground">（空）</span>;
  return (
    <span className="whitespace-pre-wrap break-words leading-7">
      {ops.map((o, i) =>
        o.op === "eq" ? (
          <span key={i}>{o.text}</span>
        ) : o.op === "del" ? (
          <del key={i} className="rounded bg-red-100 px-0.5 text-red-700 decoration-red-500 dark:bg-red-950/60 dark:text-red-300">{o.text}</del>
        ) : (
          <ins key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-800 no-underline dark:bg-emerald-950/60 dark:text-emerald-300">{o.text}</ins>
        ),
      )}
    </span>
  );
}
