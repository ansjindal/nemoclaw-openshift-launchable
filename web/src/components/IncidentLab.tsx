"use client";
import { useState, useCallback, useEffect } from "react";
import { Rocket, Bug, Stethoscope, Wrench, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type Health = { exists?: boolean; ready?: string; healthy?: boolean; pods?: string };
type Invest = { ok?: boolean; plan?: { agent: string; subtask: string }[]; results?: { agent: string; out: string }[]; answer?: string; error?: string };

// Part VI capstone "test them" lab: deploy a sample app, inject a fault, watch it go
// unhealthy, let the fleet investigate (logs/metrics/traces), read the root cause, and fix
// it — the fix is gated behind an explicit confirm (human-in-the-loop).
export function IncidentLab() {
  const [h, setH] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inv, setInv] = useState<Invest | null>(null);

  const refresh = useCallback(async () => {
    try { setH(await (await fetch("/api/incident")).json()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const act = async (action: string) => {
    if (action === "fix" && !confirm("Apply the fix to the live deployment? (human-in-the-loop)")) return;
    setBusy(action);
    try { setH(await (await fetch("/api/incident", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) })).json()); }
    finally { setBusy(null); }
  };

  const investigate = async () => {
    setBusy("investigate"); setInv(null);
    try {
      const r = await fetch("/api/orchestrate", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "The 'shop' deployment in namespace demo is unhealthy. Investigate using logs (Loki), metrics (Prometheus), and traces (Tempo), and report the root cause." }) });
      setInv(await r.json());
    } catch (e) { setInv({ ok: false, error: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  };

  const Btn = ({ a, icon, label, kind = "ghost" }: { a: string; icon: React.ReactNode; label: string; kind?: "ghost" | "go" | "warn" | "fix" }) => (
    <button onClick={() => (a === "investigate" ? investigate() : act(a))} disabled={!!busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        kind === "go" ? "bg-[var(--color-nv)] text-[#06080b] hover:bg-[var(--color-nv-bright)]"
        : kind === "warn" ? "border border-[rgba(238,0,0,0.4)] text-[var(--color-rh-bright)]"
        : kind === "fix" ? "border border-[var(--color-nv-dim)] text-[var(--color-nv-bright)]"
        : "border border-[var(--color-line-2)]"}`}>
      {busy === a ? <Loader2 size={14} className="animate-spin" /> : icon} {label}
    </button>
  );

  return (
    <div className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-nv-bright)]"><Stethoscope size={15} /> Incident Lab — test the fleet</div>
        <button onClick={refresh} className="text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"><RefreshCw size={14} /></button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-[var(--color-fg-mut)]">demo/shop:</span>
        {h?.exists ? (h.healthy
          ? <span className="inline-flex items-center gap-1 text-[var(--color-nv-bright)]"><CheckCircle2 size={14} /> healthy {h.ready}</span>
          : <span className="inline-flex items-center gap-1 text-[var(--color-rh-bright)]"><XCircle size={14} /> unhealthy {h.ready}</span>)
          : <span className="text-[var(--color-fg-mut)]">not deployed</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn a="deploy" icon={<Rocket size={14} />} label="Deploy" kind="go" />
        <Btn a="break" icon={<Bug size={14} />} label="Inject fault" kind="warn" />
        <Btn a="investigate" icon={<Stethoscope size={14} />} label="Investigate (fleet)" />
        <Btn a="fix" icon={<Wrench size={14} />} label="Apply fix ✋" kind="fix" />
      </div>

      {inv && !inv.ok && <p className="mt-3 text-sm text-[var(--color-rh-bright)]">⚠ {inv.error || "investigation failed (is the fleet up?)"}</p>}
      {inv?.ok && (
        <div className="mt-4 space-y-2 text-sm">
          {inv.results?.map((r, i) => (
            <details key={i} className="rounded-lg border border-[var(--color-line)] p-2">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--color-nv-bright)]">🦞 {r.agent}</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--color-fg-dim)]">{r.out}</pre>
            </details>
          ))}
          {inv.answer && (
            <div className="rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-bg)] p-3">
              <div className="text-xs font-semibold text-[var(--color-fg-mut)]">ROOT CAUSE</div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-sm">{inv.answer}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
