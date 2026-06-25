#!/usr/bin/env bash
# Phase 45 — run the OpenClaw agent as a Sandbox (agents.x-k8s.io/v1beta1) on MicroShift,
# pointed at the REMOTE custom OpenAI-compatible inference endpoint, and expose its gateway
# endpoint (port 18789) via an OpenShift Route.
#
# This is the "gateway in OpenShift" path: the agent-sandbox controller reconciles the
# Sandbox CR into an OpenClaw gateway pod. (NemoClaw's own `onboard` would instead spin a
# separate k3s-in-Docker gateway on the host — not what we want here.)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

export KUBECONFIG="$(kubeconfig_path)"
require_cmd oc
[[ -f "$KUBECONFIG" ]] || die "kubeconfig not found — run phase 20 first."
# Inference creds are OPTIONAL. If all three are present we pre-configure the model so the
# agent is ready to chat. If not, the agent deploys UNCONFIGURED and the user picks a
# provider/model + pastes a key in the OpenClaw UI (onboarding). Either way: never halt.
API_KEY="${NEMOCLAW_PROVIDER_KEY:-${NEMOCLAW_API_KEY:-}}"
CONFIGURED=false
if [[ -n "${NEMOCLAW_INFERENCE_BASE_URL:-}" && -n "${NEMOCLAW_MODEL:-}" && -n "$API_KEY" ]]; then
  CONFIGURED=true
fi

NS="openclaw"
INFERENCE_API="${NEMOCLAW_INFERENCE_API:-openai-completions}"

log "Creating namespace ${NS} + granting anyuid SCC (OpenClaw runs as UID 1000)"
oc create namespace "$NS" --dry-run=client -o yaml | oc apply -f -
oc -n "$NS" adm policy add-scc-to-user anyuid -z default 2>/dev/null || \
  warn "Could not grant anyuid in ${NS}."

# Build OpenClaw config (schema verified against the image: models.providers.<p>.baseUrl
# + models[] {id,name}; default via agents.defaults.model.primary). jq keeps the key safe.
if [[ "$CONFIGURED" == "true" ]]; then
  log "Building openclaw.json (model=custom/${NEMOCLAW_MODEL}, api=${INFERENCE_API})"
  OPENCLAW_JSON="$(jq -n \
    --arg url "$NEMOCLAW_INFERENCE_BASE_URL" \
    --arg key "$API_KEY" \
    --arg model "$NEMOCLAW_MODEL" \
    --arg api "$INFERENCE_API" \
    '{
       gateway: { controlUi: { dangerouslyAllowHostHeaderOriginFallback: true } },
       agents:  { defaults: { model: { primary: ("custom/" + $model) } } },
       models:  { providers: { custom: {
         baseUrl: $url, apiKey: $key, api: $api,
         models: [ { id: $model, name: $model } ]
       } } }
     }')"
else
  warn "No inference creds in env — deploying OpenClaw UNCONFIGURED."
  warn "After launch, open the OpenClaw UI and add a provider/model + key (Settings)."
  OPENCLAW_JSON='{"gateway":{"controlUi":{"dangerouslyAllowHostHeaderOriginFallback":true}}}'
fi

# Store config in a Secret (it holds the API key) + a fixed gateway password Secret.
# Fixed password (not a random token) so workshop users can be told it up front; the
# pair-approver sidecar auto-approves device pairing so the password is the only step.
GW_PASSWORD="${OPENCLAW_GATEWAY_PASSWORD:-openclaw}"
log "Creating openclaw-config Secret + gateway password Secret"
oc -n "$NS" create secret generic openclaw-config \
  --from-literal=openclaw.json="$OPENCLAW_JSON" \
  --dry-run=client -o yaml | oc apply -f -
oc -n "$NS" create secret generic openclaw-gateway-password \
  --from-literal=password="$GW_PASSWORD" \
  --dry-run=client -o yaml | oc apply -f -

# Seed the agent's identity/soul/kickoff so it boots already knowing who it is (the
# seed-workspace initContainer copies these into the workspace, create-if-missing).
SEED_DIR="$REPO_ROOT/manifests/openclaw/workspace-seed"
if [[ -d "$SEED_DIR" ]]; then
  log "Creating openclaw-workspace-seed ConfigMap (IDENTITY.md / SOUL.md / BOOTSTRAP.md)"
  oc -n "$NS" create configmap openclaw-workspace-seed \
    --from-file="$SEED_DIR" \
    --dry-run=client -o yaml | oc apply -f -
fi

# --- Make the OpenClaw image reliably available to the node ---
# ghcr.io throttles repeated large anonymous pulls (unexpected-EOF on big layers), so the
# node's in-cluster CRI-O pull can stall. We instead pull on the HOST with retries (optional
# ghcr auth via GHCR_USER/GHCR_TOKEN raises limits) and side-load into the node's CRI-O store,
# so the node never does the flaky pull. The Sandbox uses imagePullPolicy: IfNotPresent.
ENGINE="${CONTAINER_ENGINE:-podman}"
NODE_CTR="${MINC_NODE_CONTAINER:-microshift}"
PULL="sudo $ENGINE"   # MINC node runs under rootful podman/docker
# The sandbox + pair-approver containers share the same image, so the manifest has the
# line twice — take the first match only, or the doubled value becomes an invalid ref.
OPENCLAW_IMAGE="$(grep -oE 'image: ghcr.io/openclaw/openclaw:[^ ]+' "$REPO_ROOT/manifests/openclaw/openclaw-sandbox.yaml" | awk '{print $2}' | head -n1)"

ensure_image_in_node() {
  local img="$1"
  if $PULL exec "$NODE_CTR" crictl images 2>/dev/null | grep -q "${img%:*}"; then
    log "Image already in node store: $img"; return 0
  fi
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    log "Authenticating to ghcr.io (raises pull limits)"
    echo "$GHCR_TOKEN" | $PULL login ghcr.io -u "${GHCR_USER:-oauth2}" --password-stdin || \
      warn "ghcr.io login failed — continuing anonymously."
  fi
  log "Host-pulling $img (retries; resumes on EOF)"
  local n=0
  until $PULL image exists "$img" 2>/dev/null; do
    $PULL pull "$img" && break
    n=$((n+1)); (( n >= 15 )) && die "host pull of $img failed after $n attempts (ghcr.io unreachable)."
    warn "pull attempt $n hit ghcr.io flakiness — retrying in 10s"; sleep 10
  done
  local tar="/tmp/openclaw-image.tar"
  log "Side-loading $img into node '$NODE_CTR' CRI-O store"
  $PULL save "$img" -o "$tar"
  $PULL cp "$tar" "${NODE_CTR}:${tar}"
  $PULL exec "$NODE_CTR" skopeo copy "docker-archive:${tar}" "containers-storage:${img}"
  $PULL exec "$NODE_CTR" crictl images | grep -q "${img%:*}" && log "Side-load OK." || die "Side-load failed."
}
[[ -n "$OPENCLAW_IMAGE" ]] && ensure_image_in_node "$OPENCLAW_IMAGE"

log "Applying OpenClaw Sandbox + Service + Route + NodePort"
oc -n "$NS" apply -f "$REPO_ROOT/manifests/openclaw/openclaw-sandbox.yaml"
oc -n "$NS" apply -f "$REPO_ROOT/manifests/openclaw/openclaw-service.yaml"
oc -n "$NS" apply -f "$REPO_ROOT/manifests/openclaw/openclaw-route.yaml"
# NodePort (root, DNS-free) for browser access without subdomains; Route for DNS-capable access.
oc -n "$NS" apply -f "$REPO_ROOT/manifests/openclaw/openclaw-nodeport.yaml"

# Deny-by-default L4 network policy (set OPENCLAW_OPEN_SANDBOX=true to skip for an open demo).
if [[ "${OPENCLAW_OPEN_SANDBOX:-false}" != "true" ]]; then
  log "Applying deny-by-default NetworkPolicy (DNS + 443 egress, router-only ingress)"
  oc -n "$NS" apply -f "$REPO_ROOT/manifests/openclaw/openclaw-networkpolicy.yaml"
else
  warn "OPENCLAW_OPEN_SANDBOX=true — leaving the sandbox network open (no policy)."
fi

log "Waiting for the OpenClaw gateway pod to be ready"
oc -n "$NS" wait --for=condition=Ready pod/openclaw-sandbox --timeout=180s || oc -n "$NS" get pods

ROUTE_HOST="$(oc -n "$NS" get route openclaw -o jsonpath='{.spec.host}' 2>/dev/null || true)"
log "OpenClaw endpoint exposed at: https://${ROUTE_HOST}"
log "OpenClaw UI (host NodePort, DNS-free): http://<host>:30789/"
log "Control UI login password: ${GW_PASSWORD}  (device pairing is auto-approved)"
log "Confirm the model is your custom endpoint:"
# Pod has two containers now (gateway + pair-approver) — read the gateway's logs explicitly.
oc -n "$NS" logs openclaw-sandbox -c openclaw 2>&1 | grep -i "agent model" | tail -1 || true
