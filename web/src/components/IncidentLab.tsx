"use client";
import { useState, useCallback, useEffect } from "react";
import { Rocket, Bug, Stethoscope, Wrench, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { streamOrchestrate } from "@/lib/orchestrateStream";

type Health = { exists?: boolean; ready?: string; healthy?: boolean; pods?: string; current?: string; good?: string };
type Invest = { ok?: boolean; results?: { agent: string; out: string }[]; answer?: string; error?: string; synthesizedBy?: string };
type TL = { agent: string; status: "queued" | "running" | "done"; ms?: number; out?: string };
const BACKEND: Record<string, string> = { logs: "Loki", metrics: "Prometheus", traces: "Tempo", writer: "(no egress)" };

// Part VI capstone — the full incident loop in one place: deploy a sample app, inject a
// fault, watch it go unhealthy, let the FLEET investigate and RECOMMEND a fix, then the
// human reviews (and may adjust) that fix before it's applied. The fix only becomes
// available AFTER an investigation — the agents diagnose, the human approves the change.
export function IncidentLab() {
  const [h, setH] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inv, setInv] = useState<Invest | null>(null);
  const [humanImage, setHumanImage] = useState("");
  const [recommended, setRecommended] = useState<{ image: string; fromFleet: boolean }>({ image: "", fromFleet: false });
  const [timeline, setTimeline] = useState<TL[]>([]);

  const refresh = useCallback(async () => { try { setH(await (await fetch("/api/incident")).json()); } catch { /* */ } }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 6000); return () => clearInterval(t); }, [refresh]); // live pod view

  // parse the live `kubectl get pods` string: "name=Phase,WaitingReason" per line
  const pods = (h?.pods || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, rest = ""] = l.split("=");
    const [phase = "", reason = ""] = rest.split(",");
    return { name, phase, reason };
  });

  const act = async (action: string, extra: object = {}) => {
    setBusy(action);
    try {
      const r = await (await fetch("/api/incident", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) })).json();
      setH(r);
      if (action === "break") setInv(null);           // a fresh fault → re-investigate before fixing
    } finally { setBusy(null); }
  };

  const investigate = async () => {
    setBusy("investigate"); setInv(null); setTimeline([]);
    const results: { agent: string; out: string }[] = [];
    const task = "The 'shop' deployment in namespace demo is unhealthy. Investigate from logs (Loki) and metrics (Prometheus) and find the root cause.";
    try {
      await streamOrchestrate(task, (e) => {
        if (e.type === "plan") setTimeline((e.steps || []).map((s) => ({ agent: s.agent, status: "queued" })));
        else if (e.type === "step" && e.status === "start") setTimeline((tl) => tl.map((x) => x.agent === e.agent ? { ...x, status: "running" } : x));
        else if (e.type === "step" && e.status === "done") { results.push({ agent: e.agent!, out: e.out || "" }); setTimeline((tl) => tl.map((x) => x.agent === e.agent ? { ...x, status: "done", ms: e.ms, out: e.out } : x)); }
        else if (e.type === "writer") setTimeline((tl) => [...tl, { agent: "writer", status: "running" }]);
        else if (e.type === "answer") {
          setTimeline((tl) => tl.map((x) => x.agent === "writer" ? { ...x, status: "done", ms: e.ms } : x));
          setInv({ ok: true, results: [...results], answer: e.answer, synthesizedBy: e.synthesizedBy });
          const m = /RECOMMENDED_IMAGE:\s*(\S+)/i.exec(e.answer || "");   // the fix comes from the FLEET's recommendation
          const img = (m && m[1]) || h?.good || "";
          setRecommended({ image: img, fromFleet: !!m }); setHumanImage(img);
        } else if (e.type === "error") setInv({ ok: false, error: e.error });
      });
    } catch (e) { setInv({ ok: false, error: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  };

  const applyFix = async () => {
    if (!confirm(`Apply this change to the live deployment?\n  image → ${humanImage || h?.good}\n(human-in-the-loop)`)) return;
    await act("fix", { image: humanImage || h?.good });
    setInv(null);
  };

  const Btn = ({ on, icon, label, kind = "ghost", disabled, a }: { on: () => void; icon: React.ReactNode; label: string; kind?: "ghost" | "go" | "warn" | "fix"; disabled?: boolean; a: string }) => (
    <button onClick={on} disabled={!!busy || disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
        kind === "go" ? "bg-[var(--color-nv)] text-[#06080b] hover:bg-[var(--color-nv-bright)]"
        : kind === "warn" ? "border border-[rgba(238,0,0,0.4)] text-[var(--color-rh-bright)]"
        : kind === "fix" ? "bg-[var(--color-nv)] text-[#06080b] hover:bg-[var(--color-nv-bright)]"
        : "border border-[var(--color-line-2)]"}`}>
      {busy === a ? <Loader2 size={14} className="animate-spin" /> : icon} {label}
    </button>
  );

  const differs = inv?.ok && humanImage && recommended.image && humanImage !== recommended.image;

  return (
    <div className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-nv-bright)]"><Stethoscope size={15} /> Incident Lab — investigate &amp; resolve</div>
        <button onClick={refresh} className="text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"><RefreshCw size={14} /></button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-[var(--color-fg-mut)]">demo/shop:</span>
        {h?.exists ? (h.healthy
          ? <span className="inline-flex items-center gap-1 text-[var(--color-nv-bright)]"><CheckCircle2 size={14} /> healthy {h.ready}</span>
          : <span className="inline-flex items-center gap-1 text-[var(--color-rh-bright)]"><XCircle size={14} /> unhealthy {h.ready}</span>)
          : <span className="text-[var(--color-fg-mut)]">not deployed</span>}
        {h?.current && <span className="text-xs text-[var(--color-fg-mut)]">· image: <code>{h.current.split("/").pop()}</code></span>}
      </div>

      {/* live `kubectl get pods` of demo/shop (auto-refreshes) */}
      {pods.length > 0 && (
        <div className="mt-2 rounded-lg border border-[var(--color-line)] p-2">
          <div className="text-xs font-semibold text-[var(--color-fg-mut)]">PODS (live · demo/shop)</div>
          <div className="mt-1 space-y-0.5 font-mono text-xs">
            {pods.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-fg-dim)]">{p.name}</span>
                <span className={p.reason ? "text-[var(--color-rh-bright)]" : p.phase === "Running" ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg-mut)]"}>{p.reason || p.phase || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1–3: deploy/undeploy toggle, break, investigate */}
      <div className="mt-3 flex flex-wrap gap-2">
        {h?.exists
          ? <Btn a="teardown" on={() => { if (confirm("Undeploy demo/shop?")) act("teardown").then(() => { setInv(null); refresh(); }); }} icon={<Trash2 size={14} />} label="Undeploy" />
          : <Btn a="deploy" on={() => act("deploy")} icon={<Rocket size={14} />} label="1 · Deploy" kind="go" />}
        <Btn a="break" on={() => act("break")} icon={<Bug size={14} />} label="2 · Inject fault" kind="warn" disabled={!h?.exists || h?.healthy === false} />
        <Btn a="investigate" on={investigate} icon={<Stethoscope size={14} />} label="3 · Investigate (fleet)" disabled={h?.healthy !== false} />
      </div>

      {/* animated investigation — each agent pulses as it's invoked, then reveals its findings */}
      {timeline.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--color-fg-mut)]">INVESTIGATION — agents invoked in parallel</div>
          {timeline.map((x) => (
            <div key={x.agent} className={`rounded-lg border p-2 transition-colors ${x.status !== "done" ? "border-[var(--color-nv-dim)] animate-pulse" : "border-[var(--color-line)]"}`}>
              <div className="flex items-center gap-2 text-xs">
                {x.status === "done" ? <CheckCircle2 size={13} className="text-[var(--color-nv-bright)]" /> : <Loader2 size={13} className="animate-spin text-[var(--color-nv-bright)]" />}
                <span className="font-semibold">{x.agent === "writer" ? "✍️ writer" : `🦞 ${x.agent}`}</span>
                <span className="text-[var(--color-fg-mut)]">· {BACKEND[x.agent] || ""}</span>
                <span className="ml-auto text-[var(--color-fg-mut)]">{x.status === "done" ? `${((x.ms || 0) / 1000).toFixed(1)}s` : (x.agent === "writer" ? "combining findings…" : `querying ${BACKEND[x.agent] || "backend"}…`)}</span>
              </div>
              {x.status === "done" && x.out && x.agent !== "writer" && <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--color-fg-dim)]">{x.out}</pre>}
            </div>
          ))}
        </div>
      )}

      {inv && !inv.ok && <p className="mt-3 text-sm text-[var(--color-rh-bright)]">⚠ {inv.error || "investigation failed — is the fleet up? (./scripts/fleet.sh up fleet.txt)"}</p>}

      {inv?.ok && (
        <div className="mt-4 space-y-2 text-sm">
          {inv.answer && (
            <div className="rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-bg)] p-3">
              <div className="text-xs font-semibold text-[var(--color-fg-mut)]">{inv.synthesizedBy === "writer" ? "🦞 WRITER AGENT — combined root cause & recommended fix" : "ROOT CAUSE & RECOMMENDED FIX"}</div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-sm">{inv.answer}</pre>
            </div>
          )}

          {/* Step 4: human reviews & applies the fix */}
          <div className="rounded-lg border border-[var(--color-line-2)] p-3">
            <div className="text-xs font-semibold text-[var(--color-fg-mut)]">✋ YOUR FIX (human-in-the-loop)</div>
            <p className="mt-1 text-xs text-[var(--color-fg-dim)]">
              {recommended.fromFleet
                ? <>The <strong>fleet recommends</strong> setting the image to <code>{recommended.image}</code> (from its investigation above). Approve as-is, or adjust the target — you own the change that touches the cluster.</>
                : <>The fleet recommended reverting to a valid image; pre-filled with the last-known-good. Approve, or adjust — you own the change that touches the cluster.</>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--color-fg-mut)]">image →</span>
              <input value={humanImage} onChange={(e) => setHumanImage(e.target.value)}
                className="min-w-[22rem] flex-1 rounded border border-[var(--color-line-2)] bg-[var(--color-bg)] px-2 py-1 font-mono text-xs" />
              <Btn a="fix" on={applyFix} icon={<Wrench size={14} />} label="Apply fix ✋" kind="fix" />
            </div>
            {differs ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-rh-bright)]"><AlertTriangle size={12} /> Differs from the fleet's recommendation (<code>{recommended.image?.split("/").pop()}</code>) — your call, on the record.</p>
            ) : inv.ok ? <p className="mt-2 text-xs text-[var(--color-fg-mut)]">Matches the fleet's recommendation.</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
