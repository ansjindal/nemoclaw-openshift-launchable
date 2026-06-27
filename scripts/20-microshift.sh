#!/usr/bin/env bash
# Phase 20 — bring up MicroShift via MINC (MicroShift in Container, OKD build).
# Runs MicroShift inside the host's container engine — no nested virt, no RHEL
# subscription, no pull secret. Writes a kubeconfig the later phases consume.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

require_cmd minc
require_cmd oc

ENGINE="${CONTAINER_ENGINE:-podman}"
KUBECONFIG_OUT="$(kubeconfig_path)"

# Rootless Docker needs no sudo; rootful Podman does. Pick the prefix accordingly.
SUDO=""
if [[ "$ENGINE" == "podman" ]] && ! podman info >/dev/null 2>&1; then
  SUDO="sudo"
fi

log "Creating MicroShift cluster (minc create --provider ${ENGINE}) — pulls CoreOS image on first run"
$SUDO minc create --provider "$ENGINE" \
  --http-port "${MINC_HTTP_PORT:-9080}" \
  --https-port "${MINC_HTTPS_PORT:-9443}"

# `minc generate-kubeconfig` merges the context into the default kubeconfig of whichever
# user ran it (it does NOT print YAML to stdout) and can exit non-zero even when it wrote a
# valid config — so don't let `set -e` kill us here. Then copy whichever default kubeconfig
# is valid (rootless writes ~/.kube/config; rootful writes /root/.kube/config). The config
# points at the published localhost API port, so either works regardless of root/rootless.
log "Exporting kubeconfig to $KUBECONFIG_OUT"
$SUDO minc generate-kubeconfig --provider "$ENGINE" >/dev/null 2>&1 || true
copied=""
for src in "${HOME}/.kube/config" "/root/.kube/config"; do
  if $SUDO test -s "$src" 2>/dev/null && $SUDO grep -q "clusters:" "$src" 2>/dev/null; then
    $SUDO cp "$src" "$KUBECONFIG_OUT" && copied="$src" && break
  fi
done
[[ -n "$copied" ]] || die "No valid kubeconfig found after minc generate-kubeconfig (checked ~/.kube and /root/.kube)."
log "kubeconfig sourced from $copied"
$SUDO chown "$(id -un):$(id -gn)" "$KUBECONFIG_OUT" 2>/dev/null || true
chmod 600 "$KUBECONFIG_OUT" || true

export KUBECONFIG="$KUBECONFIG_OUT"
log "MicroShift up. kubeconfig at $KUBECONFIG_OUT"
$SUDO minc status --provider "$ENGINE" || true

# The MINC node's eth0 defaults to MTU 1500, but cloud egress is smaller (GCP ens4 = 1460;
# VPN/mesh tunnels e.g. netbird = 1280) and PMTU discovery is usually blackholed. Large image
# layers then stall mid-download with "unexpected EOF" while small transfers work — which is
# why pulls succeed in some environments and hang here. Clamp the node MTU below the path MTU.
NODE_CTR="${MINC_NODE_CONTAINER:-microshift}"
MINC_NODE_MTU="${MINC_NODE_MTU:-1400}"
if $SUDO "$ENGINE" exec "$NODE_CTR" ip link set dev eth0 mtu "$MINC_NODE_MTU" 2>/dev/null; then
  log "Set MINC node eth0 MTU -> ${MINC_NODE_MTU} (fixes large-image-pull EOF stalls)"
else
  warn "Could not set node MTU — large image pulls may stall on EOF if the path MTU < 1500."
fi

log "Waiting for the node to become Ready (CNI + core pods settle)"
oc wait --for=condition=Ready node --all --timeout=300s || \
  warn "Node not Ready within timeout — check 'oc get pods -A'."
oc get nodes

# MINC's MicroShift ships NO dynamic storage provisioner, so PVCs (the OpenShell gateway
# needs one) never bind. Install Rancher local-path-provisioner and make it the default
# StorageClass. Must exist BEFORE any PVC is created, or the PVC sticks in immediate-binding.
LOCAL_PATH_VERSION="${LOCAL_PATH_VERSION:-v0.0.31}"
if ! oc get sc local-path >/dev/null 2>&1; then
  log "Installing local-path-provisioner (${LOCAL_PATH_VERSION}) as the default StorageClass"
  oc apply -f "https://raw.githubusercontent.com/rancher/local-path-provisioner/${LOCAL_PATH_VERSION}/deploy/local-path-storage.yaml"
  # The provisioner mounts hostPath, which MicroShift's restricted SCC forbids.
  oc -n local-path-storage adm policy add-scc-to-user hostmount-anyuid \
    -z local-path-provisioner-service-account 2>/dev/null || \
    warn "Could not grant hostmount-anyuid to local-path-provisioner."
  oc patch storageclass local-path \
    -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
fi
oc get sc

oc get pods -A 2>/dev/null | grep -vE "Running|Completed" || log "All core pods Running."
