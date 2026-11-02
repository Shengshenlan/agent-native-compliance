// Contest-period code: dependency-free token diff (CJK per char, latin per word).
export type DiffOp = { op: "eq" | "add" | "del"; text: string };

export function tokenize(s: string): string[] {
  return s.match(/[\p{Script=Han}\p{Script=Thai}]|[\p{L}\p{N}_'.%-]+|\s+|[^\s\p{L}\p{N}]/gu) ?? [];
}

export function diffText(before: string, after: string): DiffOp[] {
  const a = tokenize(before), b = tokenize(after);
  // trim common prefix/suffix to keep the LCS table small
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
  const n = A.length, m = B.length;
  const ops: DiffOp[] = [];
  const emit = (op: DiffOp["op"], text: string) => { const last = ops[ops.length - 1]; if (last && last.op === op) last.text += text; else ops.push({ op, text }); };
  if (p) emit("eq", a.slice(0, p).join(""));
  if (n * m > 4_000_000) { if (n) emit("del", A.join("")); if (m) emit("add", B.join("")); }
  else {
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { emit("eq", A[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { emit("del", A[i]); i++; }
      else { emit("add", B[j]); j++; }
    }
    while (i < n) emit("del", A[i++]);
    while (j < m) emit("add", B[j++]);
  }
  if (s) emit("eq", a.slice(a.length - s).join(""));
  return ops;
}

export function diffStats(ops: DiffOp[]) {
  return { added: ops.filter((o) => o.op === "add").reduce((n, o) => n + o.text.length, 0), removed: ops.filter((o) => o.op === "del").reduce((n, o) => n + o.text.length, 0) };
}
