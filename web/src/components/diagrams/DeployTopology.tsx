"use client";
import { useState, type ReactNode } from "react";

// Fleet-demo-style end-to-end topology of THIS launchable: Brev VM → podman → MicroShift,
// with the OpenShell gateway, the agent-sandbox controller, and the sandbox pods, plus how
// you reach them (Routes / host-forwarded NodePorts) and remote inference. Click a box.

const NV = "#76b900", BLUE = "#6f8fd0", PURPLE = "#a78bfa", AMBER = "#e0a800",
      GREEN = "#34d399", SLATE = "#94a3b8", CYAN = "#22d3ee";

type Box = { id: string; label: string; sub?: string; color: string; detail: ReactNode };

const BOXES: Record<string, Box> = {
  gw:    { id: "gw", label: "OpenShell Gateway", sub: "StatefulSet · gRPC :8080", color: NV,
           detail: <>Helm-installed control plane. Compute driver watches the Sandbox CRD; mints sandbox JWTs; hosts policy + the <code>inference.local</code> router. Exposed to the lab shell via NodePort <code>30808</code>.</> },
  ctrl:  { id: "ctrl", label: "agent-sandbox controller", sub: "agent-sandbox-system · v0.4.6", color: BLUE,
           detail: <>kubernetes-sigs/agent-sandbox. Reconciles each <code>agents.x-k8s.io/v1alpha1</code> Sandbox CR into a Pod (+PVC). Pinned to v0.4.6 so its ownerReferences match what the gateway 0.0.70 expects.</> },
  shifty:{ id: "shifty", label: "Shifty (OpenClaw)", sub: "ns: openclaw", color: PURPLE,
           detail: <>The persistent demo agent — an OpenClaw sandbox serving its control UI (device pairing, chat). Reached via NodePort <code>30789</code>. Its identity lives in workspace <code>.md</code> files.</> },
  sbx:   { id: "sbx", label: "Sandbox pods", sub: "ns: openshell", color: GREEN,
           detail: <>Gateway-created sandboxes (e.g. <code>openshell sandbox create</code>). Each Pod = an <code>openshell-supervisor-install</code> init-container + an <code>agent</code> container, on a PVC, under a NetworkPolicy + SCC.</> },
  console:{ id: "console", label: "OpenShift Console", sub: "NodePort 30900 · /console", color: AMBER,
           detail: <>The web console for the cluster (read the whole stack as native objects). Optional phase 60. Reached at <code>/console</code> via the host forwarder.</> },
  fwd:   { id: "fwd", label: "Host NodePort forwarder", sub: "socat · systemd", color: SLATE,
           detail: <>MicroShift runs <em>inside</em> the podman container, so NodePorts aren't on the host. A systemd <code>socat</code> service forwards host <code>30789/30900/30808</code> → the MINC node IP, so Brev tunnels can reach them.</> },
  inf:   { id: "inf", label: "Remote inference", sub: "OpenAI-compatible", color: CYAN,
           detail: <>No local GPU — the privacy router forwards <code>inference.local</code> to a remote OpenAI-compatible endpoint (set in <code>.env</code>). The agent never holds the upstream key.</> },
};

export function DeployTopology() {
  const [sel, setSel] = useState("gw");
  const active = BOXES[sel];
  const B = ({ id }: { id: string }) => {
    const b = BOXES[id];
    return (
      <button onClick={() => setSel(id)}
        className="w-full rounded-lg border px-3 py-2 text-left transition"
        style={{ borderColor: b.color, background: sel === id ? `${b.color}26` : "transparent",
                 boxShadow: sel === id ? `0 0 0 1px ${b.color}` : "none", opacity: sel === id ? 1 : 0.82 }}>
        <div className="text-[13px] font-semibold" style={{ color: b.color }}>{b.label}</div>
        {b.sub && <div className="text-[10px] text-[var(--color-fg-mut)]">{b.sub}</div>}
      </button>
    );
  };

  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">What actually runs on your instance — click a box</figcaption>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        {/* the VM → podman → microshift nesting */}
        <div className="rounded-xl border border-dashed p-3" style={{ borderColor: SLATE }}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-fg-mut)]">Brev VM → podman → MicroShift node</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-line)] p-2">
              <div className="mb-1 text-[10px] text-[var(--color-fg-mut)]">ns: openshell</div>
              <div className="space-y-2"><B id="gw" /><B id="sbx" /></div>
            </div>
            <div className="rounded-lg border border-[var(--color-line)] p-2">
              <div className="mb-1 text-[10px] text-[var(--color-fg-mut)]">control + agents</div>
              <div className="space-y-2"><B id="ctrl" /><B id="shifty" /><B id="console" /></div>
            </div>
          </div>
        </div>
        {/* edges */}
        <div className="flex flex-col justify-center gap-2 md:w-[190px]">
          <B id="fwd" />
          <B id="inf" />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-fg-dim)]">
        <div className="mb-1 text-xs font-semibold" style={{ color: active.color }}>{active.label}</div>
        <div>{active.detail}</div>
      </div>
    </figure>
  );
}
