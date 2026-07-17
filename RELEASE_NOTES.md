## NemoClaw on MicroShift — v1.0.0

A [Brev Launchable](https://docs.nvidia.com/brev/concepts/launchables) that stands up a **sandboxed AI agent on single-node OpenShift** — on one CPU instance, no nested virtualization, no local GPU, no Red Hat subscription.

### The stack
- **MicroShift-in-Container (MINC)** — the OKD/CentOS-Stream build of Red Hat's lightweight OpenShift, run as a podman container on any Ubuntu host. Real OpenShift APIs (`Routes`, `SecurityContextConstraints`) and the `oc` workflow.
- **NVIDIA OpenShell** gateway (Helm chart, in-cluster Kubernetes compute driver) + the **agent-sandbox** CRD.
- **OpenClaw** agent ("Shifty" 🦞) as a policy-governed sandbox pod, wired to a **remote OpenAI-compatible inference endpoint** (NVIDIA NIM) — so no GPU on the cluster.
- **Interactive workshop site** (Next.js + a live in-browser shell) with step-by-step lessons and animated diagrams.

### Security posture (deny-by-default)
- **L4:** a Kubernetes `NetworkPolicy` allowing DNS + intra-cluster + external HTTPS only.
- **L7:** OpenShell's per-binary/method/path policy schema.

### Run it
Brev Launchable: **VM mode (Ubuntu 22.04), podman, 8 vCPU / 16 GB / 80 GB+, no GPU.**

```bash
cd nemoclaw-openshift-launchable
./scripts/setup.sh
```

Expose ports 3000 (workshop site), 30789 (OpenClaw UI), 30900 (OpenShift console). Set the remote-endpoint vars in the Launchable environment configuration.

Verified end-to-end on a Brev CPU instance: MINC brings up MicroShift (k8s v1.32), OpenShell installs via the official OpenShift method, and OpenClaw returns a completion from the remote model.
