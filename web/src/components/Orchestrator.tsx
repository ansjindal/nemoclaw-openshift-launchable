"use client";
import { useState } from "react";
import { Play, Loader2, ListOrdered } from "lucide-react";

type Step = { agent: string; subtask: string; out?: string };
type Result = { ok: boolean; fleet?: string[]; plan?: Step[]; results?: Step[]; answer?: string; error?: string };

// Part VI capstone widget: type a task, the website orchestrates the fleet — plan (completions)
// → dispatch each step to a sealed specialist agent → synthesize. Watch it in the browser.
export function Orchestrator() {
  const [task, setTask] = useState("The 'shop' deployment in namespace demo is unhealthy — investigate with logs, metrics and traces, and report the root cause.");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  const run = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task }) });
      setRes(await r.json());
    } catch (e) { setRes({ ok: false, error: e instanceof Error ? e.message : String(e) }); }
    setBusy(false);
  };

  return (
    <div className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-nv-bright)]"><ListOrdered size={15} /> Orchestrate the fleet</div>
      <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={2}
        className="mt-3 w-full rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg)] p-2.5 text-sm" />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={run} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-nv)] px-4 py-2 text-sm font-semibold text-[#06080b] hover:bg-[var(--color-nv-bright)] disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {busy ? "Running…" : "Run"}
        </button>
        {res?.fleet && <span className="text-xs text-[var(--color-fg-mut)]">fleet: {res.fleet.join(", ")}</span>}
      </div>

      {res && !res.ok && <p className="mt-3 text-sm text-[var(--color-rh-bright)]">⚠ {res.error}</p>}
      {res?.ok && (
        <div className="mt-4 space-y-3 text-sm">
          {res.plan && (
            <div>
              <div className="text-xs font-semibold text-[var(--color-fg-mut)]">PLAN</div>
              <ol className="mt-1 list-decimal pl-5 text-[var(--color-fg-dim)]">
                {res.plan.map((s, i) => <li key={i}><span className="text-[var(--color-nv-bright)]">{s.agent}</span> — {s.subtask}</li>)}
              </ol>
            </div>
          )}
          {res.results?.map((s, i) => (
            <div key={i} className="rounded-lg border border-[var(--color-line)] p-2.5">
              <div className="text-xs font-semibold text-[var(--color-nv-bright)]">🦞 {s.agent}</div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--color-fg-dim)]">{s.out}</pre>
            </div>
          ))}
          {res.answer && (
            <div className="rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-bg)] p-3">
              <div className="text-xs font-semibold text-[var(--color-fg-mut)]">SYNTHESIZED ANSWER</div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-sm">{res.answer}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
