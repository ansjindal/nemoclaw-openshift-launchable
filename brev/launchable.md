# Brev Launchable wizard settings

Map these into the 5-step [Brev Launchable](https://docs.nvidia.com/brev/concepts/launchables) wizard.

### 1. Files & Runtime
- **Code source:** Git repo → this repository.
- **Runtime mode:** **VM** (Ubuntu 22.04). We need a host container engine to run MINC;
  VM mode ships Docker preinstalled.

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
| 9443 | MicroShift API / ingress (HTTPS) |
| 9080 | MicroShift ingress (HTTP) |
| 8080 | OpenShell gateway |

Jupyter: optional/off.

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
  | `OPENCLAW_OPEN_SANDBOX` | optional; `true` skips the deny-by-default NetworkPolicy |
- **Policy & manifests** ship in the repo — applied automatically by `setup.sh`; no UI input.

> Brev has no per-launch text-field form for end-users. For a paste-your-own-key UX, ship a
> Jupyter notebook with an input cell, or have users paste into the shell post-launch.
