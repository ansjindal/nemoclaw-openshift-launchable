#!/usr/bin/env bash
# Phase 30 — deploy the OpenShell gateway onto MicroShift via the official OCI Helm
# chart, configured with the KUBERNETES compute driver so sandbox pods run as native
# MicroShift pods. MicroShift is OpenShift-derived, so SCCs apply — same security
# overrides as full OpenShift. Chart: oci://ghcr.io/nvidia/openshell/helm-chart (alpha).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

export KUBECONFIG="$(kubeconfig_path)"
require_cmd oc
require_cmd helm
[[ -f "$KUBECONFIG" ]] || die "kubeconfig not found at $KUBECONFIG — run phase 20 first."

NS="${OPENSHELL_NAMESPACE:-openshell}"
CHART="${OPENSHELL_CHART:-oci://ghcr.io/nvidia/openshell/helm-chart}"

log "Creating namespace ${NS}"
oc create namespace "$NS" --dry-run=client -o yaml | oc apply -f -

# OpenShell's Kubernetes compute driver watches the agent-sandbox CRD
# (sandboxes.agents.x-k8s.io). Without it the gateway logs a 404 watch loop and can't
# create sandboxes. Install the CRD + controller before the gateway starts.
ASB_VERSION="${AGENT_SANDBOX_VERSION:-}"
[[ -z "$ASB_VERSION" ]] && ASB_VERSION="$(curl -fsSL https://api.github.com/repos/kubernetes-sigs/agent-sandbox/releases/latest | jq -r .tag_name)"
if ! oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1; then
  log "Installing agent-sandbox CRD + controller (${ASB_VERSION})"
  oc apply -f "https://github.com/kubernetes-sigs/agent-sandbox/releases/download/${ASB_VERSION}/manifest.yaml"
fi

# SCC grants (BEFORE install — bindings may reference SAs that don't exist yet).
# Official OpenShift posture grants `privileged` to the sandbox SA. But the chart's
# pre-install certgen HOOK and the gateway run under the `openshell`/`default` SAs — on
# MicroShift those also need an SCC or the certgen Job never schedules and helm fails with
# "job openshell-certgen failed: DeadlineExceeded". So grant all three.
log "Granting SCCs (privileged: openshell-sandbox; anyuid: gateway + certgen-hook SAs)"
oc -n "$NS" adm policy add-scc-to-user privileged -z openshell-sandbox 2>/dev/null || \
  warn "Could not add privileged SCC to openshell-sandbox."
for sa in openshell default; do
  oc -n "$NS" adm policy add-scc-to-user anyuid -z "$sa" 2>/dev/null || \
    warn "Could not add anyuid SCC to '$sa'."
done

VERSION_ARG=()
[[ -n "${OPENSHELL_VERSION:-}" ]] && VERSION_ARG=(--version "$OPENSHELL_VERSION")

log "helm upgrade --install openshell (in-cluster gateway = Kubernetes compute driver)"
# upgrade --install is idempotent — a re-run reuses the existing release instead of failing
# with "cannot re-use a name that is still in use".
helm upgrade --install openshell "$CHART" "${VERSION_ARG[@]}" \
  -n "$NS" \
  -f "$REPO_ROOT/helm/openshell-values.yaml" \
  --wait --timeout 10m

# The gateway renders most settings (incl. auth) into a ConfigMap (gateway.toml), so a
# values change on a re-run won't restart the pod by itself. Force a restart so config
# changes actually take effect, then wait for the new pod.
log "Restarting the gateway to pick up config (gateway.toml) changes"
oc -n "$NS" rollout restart statefulset/openshell 2>/dev/null || true
log "Waiting for the gateway StatefulSet to become ready"
oc -n "$NS" rollout status statefulset/openshell --timeout=300s || oc -n "$NS" get pods

log "Exposing the gateway via an OpenShift Route (passthrough TLS for gRPC)"
oc apply -f "$REPO_ROOT/manifests/openshell-route.yaml"
ROUTE_HOST="$(oc -n "$NS" get route openshell-gateway -o jsonpath='{.spec.host}' 2>/dev/null || true)"
[[ -n "$ROUTE_HOST" ]] && log "Gateway endpoint: https://${ROUTE_HOST}"

log "OpenShell gateway deployed:"
oc -n "$NS" get pods,svc,route
# Sanity: the compute driver should be listing sandboxes (not 404-looping on the CRD).
if oc -n "$NS" logs openshell-0 --tail=20 2>/dev/null | grep -q "Listing sandboxes from Kubernetes"; then
  log "Kubernetes compute driver healthy (watching sandboxes.agents.x-k8s.io)."
else
  warn "Gateway up but compute-driver watch not confirmed — check 'oc -n $NS logs openshell-0'."
fi
