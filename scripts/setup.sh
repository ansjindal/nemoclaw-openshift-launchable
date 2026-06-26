#!/usr/bin/env bash
# Top-level orchestrator — this is what the Brev Launchable setup field invokes.
# Runs each phase in order; any phase can also be run standalone for debugging.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

log "NemoClaw-on-MicroShift launchable: starting provision"

"$HERE/00-preflight.sh"
"$HERE/10-host-deps.sh"
"$HERE/20-microshift.sh"
"$HERE/30-openshell.sh"
"$HERE/45-openclaw.sh"   # OpenClaw agent as a Sandbox in OpenShift (deploys even without model creds)

# The remaining phases are best-effort: a hiccup here must NOT fail the whole provision —
# the agent is already up. Log and continue so the launchable always finishes "ready".
"$HERE/50-expose-nodeports.sh" || warn "phase 50 (NodePort forwarder) failed — UIs may need a manual 'oc port-forward' or service restart."

# OpenShift/OKD web console (unauthenticated, cluster-admin — workshop/ephemeral use only).
# Set DEPLOY_CONSOLE=false in .env to skip it.
if [[ "${DEPLOY_CONSOLE:-true}" == "true" ]]; then
  "$HERE/60-console.sh" || warn "phase 60 (console) failed — non-fatal; the OpenClaw agent is still up."
fi

# Interactive workshop website (Next.js + live shell). Set DEPLOY_WORKSHOP=false to skip.
if [[ "${DEPLOY_WORKSHOP:-true}" == "true" ]]; then
  "$HERE/70-workshop.sh" || warn "phase 70 (workshop site) failed — non-fatal; the stack is still up."
fi

# Full observability stack (Prometheus + Grafana + Loki + Tempo). OPT-IN, default OFF —
# it adds real load. Set DEPLOY_MONITORING=true in .env to enable.
if [[ "${DEPLOY_MONITORING:-false}" == "true" ]]; then
  "$HERE/80-monitoring.sh" || warn "phase 80 (monitoring) failed — non-fatal; the core stack is still up."
fi

log "Done. Stack is up:"
log "  • Workshop site  : http://<host>:${WORKSHOP_PORT:-3000}/   (start here — interactive lessons + live shell)"
log "  • MicroShift API : KUBECONFIG=$(kubeconfig_path) oc get nodes"
log "  • OpenShell gw   : oc -n ${OPENSHELL_NAMESPACE:-openshell} get route openshell-gateway"
log "  • OpenClaw UI    : oc -n openclaw get route openclaw  (host NodePort: http://<host>:30789/)"
log "  • OpenShift console : http://<host>:30900/console/"
