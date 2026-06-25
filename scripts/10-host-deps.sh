#!/usr/bin/env bash
# Phase 10 — host packages on the Ubuntu Brev VM: container engine, the OpenShift CLI
# (oc) + kubectl, helm, and the MINC binary. No libvirt/KVM — MicroShift runs in a
# container, not a nested VM.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

ENGINE="${CONTAINER_ENGINE:-docker}"
MINC_VERSION="${MINC_VERSION:-latest}"

log "Ensuring base tooling"
sudo apt-get update -y
sudo apt-get install -y curl tar jq

# MINC requires podman — Docker's read-only overlay mount breaks the nested CRI-O
# layer store (verified on the Brev box). Install podman regardless of CONTAINER_ENGINE.
log "Ensuring container engine: podman (required by MINC)"
command -v podman >/dev/null 2>&1 || sudo apt-get install -y podman

log "Installing OpenShift CLI (oc) + kubectl"
if ! command -v oc >/dev/null 2>&1; then
  curl -fsSL https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz \
    | sudo tar xz -C /usr/local/bin oc kubectl
fi
oc version --client || true

log "Installing helm"
command -v helm >/dev/null 2>&1 || \
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

log "Installing MINC (MicroShift in Container)"
if ! command -v minc >/dev/null 2>&1; then
  url="https://github.com/minc-org/minc/releases/${MINC_VERSION}/download/minc_linux_amd64"
  [[ "$MINC_VERSION" == "latest" ]] && \
    url="https://github.com/minc-org/minc/releases/latest/download/minc_linux_amd64"
  curl -LsSf -o /tmp/minc "$url"
  chmod +x /tmp/minc
  sudo mv /tmp/minc /usr/local/bin/minc
fi
minc version 2>/dev/null || minc --help >/dev/null 2>&1 || true

log "Host dependencies installed."
