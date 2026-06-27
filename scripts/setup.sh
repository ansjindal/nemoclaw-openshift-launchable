#!/usr/bin/env bash
# Top-level orchestrator — this is what the Brev Launchable setup field invokes.
# Runs each phase in order; any phase can also be run standalone for debugging.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

log "NemoClaw-on-MicroShift launchable: starting provision"

# Pre-provision the PLATFORM up to and including the OpenShell gateway (the slow,
# finicky parts). Creating the OpenClaw AGENT is left as a HANDS-ON lesson — participants
# run scripts/45-openclaw.sh (or its commands) themselves against the live gateway.
"$HERE/00-preflight.sh"
"$HERE/10-host-deps.sh"
"$HERE/20-microshift.sh"
"$HERE/30-openshell.sh"          # OpenShell gateway (Helm) + Envoy Gateway ingress
# NOTE: phase 45 (create the OpenClaw agent) is intentionally NOT run here — it's the
# first hands-on step participants do. Set PROVISION_AGENT=true to pre-create it anyway.
[[ "${PROVISION_AGENT:-false}" == "true" ]] && "$HERE/45-openclaw.sh"

# The remaining phases are best-effort: a hiccup here must NOT fail the whole provision.
# Log and continue so the launchable always finishes "ready".
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

log "Done. Platform is up — now build your agent in the workshop:"
log "  • Workshop site  : http://<host>:${WORKSHOP_PORT:-3000}/   (START HERE — step-by-step lessons + live shell)"
log "  • MicroShift API : KUBECONFIG=$(kubeconfig_path) oc get nodes"
log "  • OpenShell gw   : openshell status   (host :30808 via Envoy Gateway)"
log "  • OpenShift console : http://<host>:30900/console/"
log "  → Create your OpenClaw agent hands-on in the workshop (it is NOT pre-provisioned)."
log "    Once created, its UI is http://<host>:${OPENCLAW_UI_PORT:-18789}/ (password: ${OPENCLAW_GATEWAY_PASSWORD:-openclaw})."
