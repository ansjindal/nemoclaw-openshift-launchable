"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Server, Box } from "lucide-react";

type Sandbox = { name: string; phase: string; ready: boolean; restarts: number; created: string | null };
type Data = { ok: boolean; error?: string; gateway?: { ready: boolean; version: string | null }; sandboxes?: Sandbox[]; at?: string };

function age(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.floor(s / 60)}m`;
  if (s < 172800) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function LiveOpenShell() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/openshell", { cache: "no-store" });
      setData(await r.json());
    } catch (e) {
      setData({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000); // live: re-poll the gateway every 6s
    return () => clearInterval(t);
  }, [load]);

  const gw = data?.gateway;
  const sandboxes = data?.sandboxes ?? [];

  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <figcaption className="text-sm text-[var(--color-fg-mut)]">Live from your gateway — auto-refreshes</figcaption>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[11px] text-[var(--color-fg-mut)] transition hover:text-[var(--color-fg)]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* gateway status */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3 py-2.5">
        <Server size={15} className="text-[var(--color-fg-mut)]" />
        <span className="text-[13px] font-semibold text-[var(--color-fg)]">OpenShell gateway</span>
        {data && data.ok ? (
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: gw?.ready ? "var(--color-nv-bright)" : "#ee5555" }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: gw?.ready ? "#76b900" : "#ee5555", display: "inline-block" }} />
            {gw?.ready ? "Connected" : "Not ready"}{gw?.version ? ` · ${gw.version}` : ""}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--color-fg-mut)]">{data ? "unreachable" : "loading…"}</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[var(--color-fg-mut)]">ns: openshell</span>
      </div>

      {/* sandboxes */}
      {data && !data.ok ? (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-3 text-[12px] text-[var(--color-fg-mut)]">
          Couldn&apos;t reach the gateway: <code>{data.error}</code> — is the stack up? (<code>openshell status</code> in the shell)
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[var(--color-bg-2)] text-[var(--color-fg-mut)]">
              <tr>
                <th className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1"><Box size={12} /> Sandbox</span></th>
                <th className="px-3 py-2 font-medium">Phase</th>
                <th className="px-3 py-2 font-medium">Ready</th>
                <th className="px-3 py-2 font-medium">Restarts</th>
                <th className="px-3 py-2 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {sandboxes.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-[var(--color-fg-mut)]">No sandboxes yet — create one in <em>Build Your Agent</em>.</td></tr>
              ) : sandboxes.map((s) => (
                <tr key={s.name} className="border-t border-[var(--color-line)]">
                  <td className="px-3 py-2 font-mono text-[var(--color-fg)]">{s.name}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-dim)]">{s.phase}</td>
                  <td className="px-3 py-2" style={{ color: s.ready ? "var(--color-nv-bright)" : "#e0a800" }}>{s.ready ? "yes" : "no"}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-dim)]">{s.restarts}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-mut)]">{age(s.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-[var(--color-fg-mut)]">Source: <code>oc -n openshell get sandboxes.agents.x-k8s.io -o json</code> via <code>/api/openshell</code> — the same data <code>openshell sandbox list</code> shows.</p>
    </figure>
  );
}
