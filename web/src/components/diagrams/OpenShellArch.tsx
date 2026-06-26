import { ArchExplorer } from "./ArchExplorer";

const NV = "#76b900", PURPLE = "#a78bfa", BLUE = "#6f8fd0", GREEN = "#34d399", AMBER = "#e0a800", CYAN = "#22d3ee";

export function OpenShellArch() {
  return (
    <ArchExplorer
      title="OpenShell isn’t one thing — click each part"
      nodes={[
        { id: "gw", label: "Gateway", sub: "control plane · gRPC :8080", color: NV, detail: <>The OpenShell <strong>gateway</strong> — the brain. A Helm-installed workload (StatefulSet on SQLite, or HA Deployment on Postgres) that exposes a gRPC API and hosts the pieces below: the compute driver, the inference L7 proxy, supervisor bootstrap, policy, and mTLS.</> },
        { id: "driver", label: "Compute driver", sub: "Kubernetes", color: BLUE, detail: <>Watches and creates sandboxes. On <code>openshell sandbox create</code> it writes an <code>agents.x-k8s.io Sandbox</code> CR and wires the sandbox up. Healthy = the log line <code>Listing sandboxes from Kubernetes</code>. Other drivers exist; we use the Kubernetes one.</> },
        { id: "l7", label: "Inference router", sub: "L7 proxy · inference.local", color: CYAN, detail: <>The <strong>L7 / privacy proxy</strong>. Every sandbox calls one URL — <code>inference.local</code>. The gateway <strong>strips the sandbox’s creds and injects the real backend key + model</strong>, so the agent never holds the upstream key. Change the backend once at the gateway and it propagates to all sandboxes in ~5s.</> },
        { id: "supervisor", label: "Supervisor", sub: "openshell-sandbox · in each sandbox", color: PURPLE, detail: <>The <code>openshell-sandbox</code> <strong>supervisor</strong> the gateway sideloads into every sandbox (init-container / image-volume). It bootstraps and oversees the agent process inside the pod and enforces the sandbox-side policy. <em>(Our minimal launchable runs OpenClaw as a direct CR, so it doesn’t sideload the supervisor — this is how the full product wires fleets.)</em></> },
        { id: "policy", label: "Policy + mTLS", sub: "deny-by-default", color: AMBER, detail: <>Per-sandbox L7 policy (the per-binary/method/path schema in <code>policies/</code>) plus mTLS between components. Combined with OpenShift NetworkPolicy + SCCs, this is the defense-in-depth that bounds what an agent can do.</> },
        { id: "sig", label: "agent-sandbox", sub: "kubernetes-sigs · the CRD", color: GREEN, detail: <>Underneath it all is the open-source <strong>kubernetes-sigs/agent-sandbox</strong> project: the <code>Sandbox</code> CRD (<code>agents.x-k8s.io</code>) + a controller that reconciles a CR into a Pod + storage. OpenShell builds on this primitive; <code>oc get sandboxes</code> shows the fleet as plain Kubernetes objects.</> },
      ]}
    />
  );
}
