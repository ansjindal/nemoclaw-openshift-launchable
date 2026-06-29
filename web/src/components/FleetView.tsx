"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, Circle, ShieldCheck, Loader2 } from "lucide-react";

type Agent = { name: string; role: string; ready: boolean; egress: string[] };

// Part VI capstone — the whole fleet on one page: each agent's status and the exact egress
// its policy allows. Side by side, you can SEE that every agent's policy is specific to its
// tool (logs→Loki, metrics→Prometheus, traces→Tempo, writer→none) — all plus the shared registry.
export function FleetView() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setAgents((await (await fetch("/api/fleet")).json()).agents ?? []); } catch { setAgents([]); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const tool = (e: string) => /loki/.test(e) ? "Loki" : /prometheus/.test(e) ? "Prometheus" : /tempo/.test(e) ? "Tempo" : /registry/.test(e) ? "registry" : e;

  return (
    <div className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-nv-bright)]"><ShieldCheck size={15} /> The fleet, at a glance</div>
        <button onClick={load} disabled={busy} className="text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(agents ?? []).map((a) => (
          <div key={a.name} className="rounded-lg border border-[var(--color-line)] p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{a.name}</span>
              {a.ready
                ? <span className="inline-flex items-center gap-1 text-xs text-[var(--color-nv-bright)]"><CheckCircle2 size={12} /> Ready</span>
                : <span className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-mut)]"><Circle size={12} /> not up</span>}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-fg-dim)]">{a.role}</div>
            <div className="mt-2 text-xs text-[var(--color-fg-mut)]">may reach:</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {a.egress.length === 0 && <span className="rounded border border-[var(--color-line-2)] px-1.5 py-0.5 text-xs text-[var(--color-fg-mut)]">nothing (no egress)</span>}
              {a.egress.map((e) => (
                <span key={e} className={`rounded border px-1.5 py-0.5 text-xs ${/registry/.test(e) ? "border-[var(--color-line-2)] text-[var(--color-fg-mut)]" : "border-[var(--color-nv-dim)] text-[var(--color-nv-bright)]"}`}>{tool(e)}</span>
              ))}
            </div>
          </div>
        ))}
        {agents && agents.length === 0 && <p className="text-sm text-[var(--color-fg-mut)]">No fleet agents found — bring them up with <code>./scripts/fleet.sh up fleet.txt</code>.</p>}
      </div>
      <p className="mt-3 text-xs text-[var(--color-fg-mut)]">Every agent shares the in-cluster <strong>registry</strong> (to install skills); beyond that, each reaches <strong>only its own tool</strong>. That's the policy being specific to the agent.</p>
    </div>
  );
}
