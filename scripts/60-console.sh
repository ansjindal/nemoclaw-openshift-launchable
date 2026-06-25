#!/usr/bin/env bash
# Phase 60 (OPTIONAL) — deploy the standalone OpenShift/OKD web console for MicroShift.
# NOT run by setup.sh by default. Run explicitly: ./scripts/60-console.sh
#
# ⚠️ Unauthenticated admin console (MicroShift has no OAuth) — workshop/ephemeral use only.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

export KUBECONFIG="$(kubeconfig_path)"
require_cmd oc
[[ -f "$KUBECONFIG" ]] || die "kubeconfig not found — run phase 20 first."

warn "Deploying an UNAUTHENTICATED, cluster-admin OpenShift console exposed via Route."
warn "Use only on an ephemeral workshop instance."

oc apply -f "$REPO_ROOT/manifests/console/openshift-console.yaml"
# NodePort (root, DNS-free) for browser access without a subdomain.
oc apply -f "$REPO_ROOT/manifests/console/console-nodeport.yaml"

log "Waiting for the console (pulls a large image on first run)"
oc -n openshift-console rollout status deploy/console --timeout=420s || oc -n openshift-console get pods

ROUTE_HOST="$(oc -n openshift-console get route console -o jsonpath='{.spec.host}' 2>/dev/null || true)"
# Served under /console/ (BRIDGE_BASE_PATH) on the shared router host — the gateway path.
log "OpenShift console: https://${ROUTE_HOST}/console/  (via the router's published HTTPS port, e.g. :9443)"
log "DNS-free fallback (NodePort): http://<node-ip>:30900/console/"
