# Brev Launchable wizard settings

Map these into the 5-step [Brev Launchable](https://docs.nvidia.com/brev/concepts/launchables) wizard.

### 1. Files & Runtime
- **Code source:** Git repo → this repository. **If the repo is private**, connect a GitHub
  account (or use a deploy token) in the Launchable so Brev can clone it.
- **Runtime mode:** **VM** (Ubuntu 22.04). We need a host container engine to run MINC.
  **Use podman, not Docker** — Docker's read-only overlay breaks nested CRI-O. Phase 10
  (`10-host-deps.sh`) installs/ensures podman; keep `CONTAINER_ENGINE=podman`.

### 2. Environment
- **Base:** Ubuntu 22.04 (VM-mode default).
- **Setup script:**
  ```bash
  cd nemoclaw-openshift-launchable
  cp .env.example .env   # fill in remote-endpoint vars (or inject via Brev secrets)
  ./scripts/setup.sh
  ```

### 3. Jupyter & Networking — expose ports
| Port | Purpose |
|------|---------|
| 30789 | **OpenClaw UI** — the agent (served at `/`). Main user-facing port. |
| 30900 | **OpenShift console** — served at `/console/`. |
| 9443 | MicroShift router HTTPS (Routes, e.g. OpenShell gateway) |
| 9080 | MicroShift router HTTP |
| 6443 | MicroShift API server (optional, for `oc` from outside) |

`30789`/`30900` are host NodePorts published by phase 50's systemd forwarder — these are
what attendees actually open via their Brev URL. Jupyter: optional/off.

### 4. Compute
- **GPU:** none — inference is a remote endpoint.
- **Sizing:** 8 vCPU, 16 GB RAM, 80 GB+ disk. No nested virtualization required.

### 5. Review
- Name: `nemoclaw-microshift`.
- **Variables:** set these in the **Launchable environment configuration** (the scripts read
  them straight from the environment — no `.env` needed on Brev):
  | Var | Notes |
  |-----|-------|
  | `NEMOCLAW_INFERENCE_BASE_URL` | remote OpenAI-compatible endpoint URL |
  | `NEMOCLAW_MODEL` | model id served by that endpoint |
  | `NEMOCLAW_API_KEY` | **mark as secret** |
  | `CONTAINER_ENGINE` | `podman` (required) |
  | `OPENCLAW_GATEWAY_PASSWORD` | Control-UI login password (default `openclaw`) — what attendees type |
  | `DEPLOY_CONSOLE` | `true` (default) deploys the OpenShift console; `false` skips phase 60 |
  | `OPENCLAW_OPEN_SANDBOX` | optional; `true` skips the deny-by-default NetworkPolicy |
- **Policy & manifests** ship in the repo — applied automatically by `setup.sh`; no UI input.

> Brev has no per-launch text-field form for end-users. For a paste-your-own-key UX, ship a
> Jupyter notebook with an input cell, or have users paste into the shell post-launch.
