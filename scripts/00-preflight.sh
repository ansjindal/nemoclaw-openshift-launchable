#!/usr/bin/env bash
# Phase 00 — preflight. No nested virt or GPU needed in this topology: MicroShift runs
# as a container (MINC) and inference is remote. We just need a container engine,
# enough CPU/RAM/disk for MicroShift + OpenShell, and the remote-endpoint settings.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

log "Preflight checks"

# --- resources ---
CPUS=$(nproc)
RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo)
DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
log "Host: ${CPUS} vCPU, ${RAM_GB} GB RAM, ${DISK_GB} GB free on /"
(( CPUS  >= 4  )) || warn "Fewer than 4 vCPU — MicroShift + OpenShell will be tight."
(( RAM_GB >= 8  )) || warn "Less than 8 GB RAM — MicroShift wants 2 GB; OpenShell + sandboxes need headroom."
(( DISK_GB >= 40 )) || warn "Less than 40 GB free — CoreOS image + sandbox images may not fit."

# --- container engine (MINC runs MicroShift inside it) ---
ENGINE="${CONTAINER_ENGINE:-podman}"
if command -v "$ENGINE" >/dev/null 2>&1; then
  log "Container engine '${ENGINE}' present"
else
  warn "'${ENGINE}' not found — phase 10 will install it."
fi

# --- remote inference endpoint (OPTIONAL) ---
# Hybrid model config: if these are set the agent is pre-configured; if not, it deploys
# UNCONFIGURED and the user adds a provider/model/key in the OpenClaw UI. So warn, never fail —
# preflight must not halt the whole provision just because creds weren't supplied.
[[ -n "${NEMOCLAW_INFERENCE_PROVIDER:-}" ]] || warn "NEMOCLAW_INFERENCE_PROVIDER unset — agent will deploy unconfigured (set the model in the OpenClaw UI)."
[[ -n "${NEMOCLAW_INFERENCE_BASE_URL:-}" ]] || warn "NEMOCLAW_INFERENCE_BASE_URL empty — agent will deploy unconfigured."
[[ -n "${NEMOCLAW_API_KEY:-}" ]]            || warn "NEMOCLAW_API_KEY empty — agent will deploy unconfigured."

log "Preflight complete. (No nested virtualization or local GPU required.)"
