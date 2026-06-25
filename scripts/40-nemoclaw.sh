#!/usr/bin/env bash
# Phase 40 — install NemoClaw on the host and onboard it against the OpenShell gateway
# in MicroShift, pointing inference at a REMOTE endpoint (no local GPU). NemoClaw drives
# onboarding/policy; OpenShell (in-cluster) creates sandbox pods via the k8s driver.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

export KUBECONFIG="$(kubeconfig_path)"
NS="${OPENSHELL_NAMESPACE:-openshell}"
require_var NEMOCLAW_INFERENCE_PROVIDER

log "Installing NemoClaw CLI"
command -v nemoclaw >/dev/null 2>&1 || curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash

# Reach the in-cluster gateway from the host. For a workshop, port-forward in the
# background; in production publish a MicroShift Route instead.
log "Port-forwarding OpenShell gateway 8080 -> localhost"
oc -n "$NS" port-forward svc/openshell 8080:8080 >/tmp/openshell-pf.log 2>&1 &
PF_PID=$!
sleep 5

export NEMOCLAW_AGENT="${NEMOCLAW_AGENT:-openclaw}"
export OPENSHELL_GATEWAY="${OPENSHELL_GATEWAY:-http://localhost:8080}"

POLICY_FILE="${NEMOCLAW_POLICY_FILE:-policies/openclaw-sandbox.yaml}"
[[ -f "$REPO_ROOT/$POLICY_FILE" ]] || warn "Policy file $POLICY_FILE not found — onboard will use the tier default."

log "Onboarding NemoClaw (agent=${NEMOCLAW_AGENT}, tier=${NEMOCLAW_POLICY_TIER:-balanced}, policy=${POLICY_FILE})"
# Non-interactive flags vary by NemoClaw version; if rejected, run 'nemoclaw onboard'
# interactively once and the choices persist.
nemoclaw onboard \
  --agent "$NEMOCLAW_AGENT" \
  --inference-provider "$NEMOCLAW_INFERENCE_PROVIDER" \
  --inference-base-url "${NEMOCLAW_INFERENCE_BASE_URL:-}" \
  --model "${NEMOCLAW_MODEL:-}" \
  --api-key "${NEMOCLAW_API_KEY:-}" \
  --gateway "$OPENSHELL_GATEWAY" \
  --sandbox-name "${NEMOCLAW_SANDBOX_NAME:-workshop-sandbox}" \
  --policy-tier "${NEMOCLAW_POLICY_TIER:-balanced}" \
  --policy "$REPO_ROOT/$POLICY_FILE" \
  --non-interactive || {
    warn "Non-interactive onboard failed — falling back to interactive."
    nemoclaw onboard
  }

log "NemoClaw onboarded. Sandbox pods appear in namespace ${NS}:"
oc -n "$NS" get pods
log "PID $PF_PID holds the gateway port-forward (kill it to stop)."
