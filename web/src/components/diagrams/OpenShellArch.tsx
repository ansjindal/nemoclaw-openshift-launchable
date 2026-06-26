import { ArchExplorer } from "./ArchExplorer";

const NV = "#76b900", PURPLE = "#a78bfa", BLUE = "#6f8fd0", GREEN = "#34d399", AMBER = "#e0a800";

export function OpenShellArch() {
  return (
    <ArchExplorer
      flow
      title="OpenShell — how an agent request becomes a sandboxed pod (click each step)"
      nodes={[
        { id: "crd", label: "Sandbox CRD", sub: "sandboxes.agents.x-k8s.io", color: BLUE, detail: <>A Kubernetes custom resource describing a desired agent sandbox. You (or the operator) create one; OpenShell does the rest. Installed before the gateway.</> },
        { id: "gw", label: "OpenShell gateway", sub: "control plane · :8080", color: NV, detail: <>The sandbox control plane. Its <strong>Kubernetes compute driver</strong> watches the Sandbox CRD and reconciles each one into a real pod. Healthy = log line “Listing sandboxes from Kubernetes”.</> },
        { id: "pod", label: "Sandbox pod", sub: "the agent (OpenClaw)", color: PURPLE, detail: <>The isolated pod OpenShell creates — where OpenClaw (“Shifty”) actually runs, under the namespace’s RBAC + Security Context Constraints.</> },
        { id: "policy", label: "Policy", sub: "deny-by-default", color: AMBER, detail: <>Each sandbox is bound by policy — what filesystem, network, and tools it may touch. Deny-by-default; you widen it deliberately. Combined with OpenShift NetworkPolicy + SCCs.</> },
        { id: "infer", label: "Inference", sub: "remote endpoint", color: GREEN, detail: <>The sandbox has no GPU — the agent calls out to a remote OpenAI-compatible model. OpenShell brokers the egress the policy allows.</> },
      ]}
    />
  );
}
