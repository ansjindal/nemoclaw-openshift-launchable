"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Server, Box, ScrollText, Shield } from "lucide-react";

type Sandbox = { name: string; phase: string; ready: boolean; restarts: number; created: string | null };
type Data = { ok: boolean; error?: string; gateway?: { ready: boolean; version: string | null }; sandboxes?: Sandbox[] };

function age(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.floor(s / 60)}m`;
  if (s < 172800) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type Tab = "logs" | "policy";

export function LiveOpenShell() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("logs");
  const [source, setSource] = useState<"all" | "gateway" | "sandbox">("all");
  const [detail, setDetail] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(false);

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

  const loadDetail = useCallback(async (name: string, t: Tab, src: string) => {
    setDetailLoading(true);
    setDetail("");
    try {
      const q = t === "logs" ? `logs=${encodeURIComponent(name)}&source=${src}` : `policy=${encodeURIComponent(name)}`;
      const r = await fetch(`/api/openshell?${q}`, { cache: "no-store" });
      const j = await r.json();
      setDetail(j.text ?? j.error ?? "(no output)");
    } catch (e) {
      setDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  // (re)load the detail whenever the selected sandbox / tab / source changes
  useEffect(() => {
    if (sel) loadDetail(sel, tab, source);
  }, [sel, tab, source, loadDetail]);

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
                <tr key={s.name} onClick={() => setSel(s.name === sel ? null : s.name)}
                  className={`cursor-pointer border-t border-[var(--color-line)] transition hover:bg-[var(--color-bg-2)] ${sel === s.name ? "bg-[var(--color-bg-2)]" : ""}`}>
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

      {/* per-sandbox detail: logs + policy */}
      {sel && (
        <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
            <span className="font-mono text-[12px] text-[var(--color-fg)]">{sel}</span>
            <div className="ml-2 inline-flex overflow-hidden rounded-md border border-[var(--color-line-2)] text-[11px]">
              {(["logs", "policy"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className="inline-flex items-center gap-1 px-2.5 py-1 font-medium transition"
                  style={{ background: tab === t ? "var(--color-nv)" : "transparent", color: tab === t ? "#06080b" : "var(--color-fg-dim)" }}>
                  {t === "logs" ? <ScrollText size={11} /> : <Shield size={11} />} {t === "logs" ? "Logs / audit" : "Policy"}
                </button>
              ))}
            </div>
            {tab === "logs" && (
              <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line-2)] text-[10px]">
                {(["all", "gateway", "sandbox"] as const).map((s) => (
                  <button key={s} onClick={() => setSource(s)} className="px-2 py-1 transition"
                    style={{ background: source === s ? "var(--color-line-2)" : "transparent", color: source === s ? "var(--color-fg)" : "var(--color-fg-mut)" }}>{s}</button>
                ))}
              </div>
            )}
            <button onClick={() => sel && loadDetail(sel, tab, source)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
              <RefreshCw size={11} className={detailLoading ? "animate-spin" : ""} /> reload
            </button>
          </div>
          <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[var(--color-code-fg)]">{detailLoading ? "loading…" : (detail || "(no output)")}</pre>
        </div>
      )}

      <p className="mt-2 text-[10px] text-[var(--color-fg-mut)]">
        Click a sandbox for its <strong>logs/audit</strong> (<code>openshell logs &lt;name&gt; --source …</code>) and full <strong>policy</strong> (<code>openshell policy get &lt;name&gt; --full</code>). Served read-only via <code>/api/openshell</code>.
      </p>
    </figure>
  );
}
