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
"$HERE/45-openclaw.sh"   # OpenClaw agent as a Sandbox in OpenShift + Route (gateway-in-OpenShift path)
"$HERE/50-expose-nodeports.sh"  # publish MicroShift NodePorts on the host (Brev-URL reachable)

# OpenShift/OKD web console (unauthenticated, cluster-admin — workshop/ephemeral use only).
# Set DEPLOY_CONSOLE=false in .env to skip it.
if [[ "${DEPLOY_CONSOLE:-true}" == "true" ]]; then
  "$HERE/60-console.sh"
fi

log "Done. Stack is up:"
log "  • MicroShift API : KUBECONFIG=$(kubeconfig_path) oc get nodes"
log "  • OpenShell gw   : oc -n ${OPENSHELL_NAMESPACE:-openshell} get route openshell-gateway"
log "  • OpenClaw UI    : oc -n openclaw get route openclaw  (host NodePort: http://<host>:30789/)"
log "  • OpenShift console : http://<host>:30900/console/"
