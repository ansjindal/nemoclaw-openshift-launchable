#!/usr/bin/env bash
# Phase 45 — create the OpenClaw agent the STANDARD OpenShell way: a GATEWAY-managed
# sandbox (`openshell sandbox create` against the in-cluster gateway), NOT a hand-applied
# Sandbox CR and NOT nemoclaw. The OpenShell supervisor seals the agent in its own network
# namespace and governs egress through its proxy (deny-by-default + our policy). We then
# start the OpenClaw gateway inside the sandbox and expose its Control UI to the host with
# `openshell forward` (a NodePort cannot reach a sealed sandbox — the UI port lives in the
# agent's private netns; only the supervisor bridges it).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

export KUBECONFIG="$(kubeconfig_path)"
require_cmd oc
[[ -f "$KUBECONFIG" ]] || die "kubeconfig not found — run phase 20 first."

NS="${OPENSHELL_NAMESPACE:-openshell}"
AGENT="${OPENCLAW_AGENT_NAME:-shifty}"
UI_PORT="${OPENCLAW_UI_PORT:-18789}"
GW_PASSWORD="${OPENCLAW_GATEWAY_PASSWORD:-openclaw}"
SANDBOX_IMAGE="${OPENCLAW_SANDBOX_IMAGE:-ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest}"
GW_URL="${OPENSHELL_CLI_ENDPOINT:-http://127.0.0.1:30808}"

# Inference creds (optional — if missing, the agent deploys UNCONFIGURED and the user
# picks a provider/model + pastes a key in the OpenClaw UI). Never halt.
API_KEY="${NEMOCLAW_PROVIDER_KEY:-${NEMOCLAW_API_KEY:-}}"
BASE_URL="${NEMOCLAW_INFERENCE_BASE_URL:-}"
MODEL="${NEMOCLAW_MODEL:-}"
INFERENCE_API="${NEMOCLAW_INFERENCE_API:-openai-completions}"
CONFIGURED=false
[[ -n "$BASE_URL" && -n "$MODEL" && -n "$API_KEY" ]] && CONFIGURED=true
INFERENCE_HOST="$(printf '%s' "$BASE_URL" | sed -E 's#^https?://##; s#/.*##; s#:.*##')"

# --- the openshell CLI must be installed + pointed at the in-cluster gateway ---
if ! command -v openshell >/dev/null 2>&1; then
  log "Installing the openshell CLI"
  curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh >/dev/null 2>&1 \
    || die "openshell CLI install failed — required to create the gateway sandbox."
fi
export PATH="$PATH:$HOME/.local/bin"
log "Registering + selecting the OpenShell gateway at ${GW_URL}"
openshell gateway add "$GW_URL" --local --name cluster >/dev/null 2>&1 || true
openshell gateway select cluster >/dev/null 2>&1 || true
openshell status >/dev/null 2>&1 || warn "Gateway not answering at ${GW_URL} — is phase 30/50 done?"

# --- render the egress policy (deny-by-default + inference + openclaw hosts) ---
POLICY_SRC="$REPO_ROOT/policies/openclaw-sandbox.yaml"
POLICY_RENDERED="/tmp/openclaw-sandbox.rendered.yaml"
if [[ -f "$POLICY_SRC" && -n "$INFERENCE_HOST" ]]; then
  sed "s/__INFERENCE_HOST__/${INFERENCE_HOST}/g" "$POLICY_SRC" > "$POLICY_RENDERED"
  POLICY_ARG=(--policy "$POLICY_RENDERED")
  log "Rendered egress policy (inference host: ${INFERENCE_HOST})"
else
  warn "No policy/inference host — sandbox will use the gateway default policy."
  POLICY_ARG=()
fi

# --- create the agent as a gateway-managed sandbox ---
ox() { openshell sandbox exec -n "$AGENT" -- "$@"; }
log "Creating gateway sandbox '${AGENT}' from ${SANDBOX_IMAGE}"
openshell sandbox delete "$AGENT" >/dev/null 2>&1 || true
sleep 2
openshell sandbox create --name "$AGENT" "${POLICY_ARG[@]}" \
  --from "$SANDBOX_IMAGE" -- sh -c 'sleep infinity' >/tmp/openclaw-create.log 2>&1 &
log "Waiting for the sandbox supervisor to finish bootstrap (gateway phase Ready)"
ready=false
for i in $(seq 1 48); do
  sleep 5
  if openshell sandbox exec -n "$AGENT" -- true >/dev/null 2>&1; then
    ready=true; log "Sandbox exec-ready after $((i*5))s"; break
  fi
done
[[ "$ready" == true ]] || { warn "Sandbox not ready — create log:"; tail -8 /tmp/openclaw-create.log; }

# --- build OpenClaw config (inference + gateway auth) and stage it into /sandbox ---
# HOME=/sandbox; config at ~/.openclaw/openclaw.json. The agent is Landlock-confined to
# /sandbox + /tmp, so stage via `openshell sandbox exec` (base64 — exec rejects newlines).
if [[ "$CONFIGURED" == true ]]; then
  log "Configuring OpenClaw model (custom/${MODEL} via ${INFERENCE_API})"
  OPENCLAW_JSON="$(jq -n \
    --arg url "$BASE_URL" --arg key "$API_KEY" --arg model "$MODEL" \
    --arg api "$INFERENCE_API" --arg pw "$GW_PASSWORD" \
    '{
       gateway: { auth: { password: $pw }, remote: { password: $pw },
                  controlUi: { dangerouslyAllowHostHeaderOriginFallback: true } },
       agents:  { defaults: { model: { primary: ("custom/" + $model) } } },
       models:  { providers: { custom: {
         baseUrl: $url, apiKey: $key, api: $api,
         models: [ { id: $model, name: $model } ]
       } } }
     }')"
else
  warn "No inference creds in env — deploying OpenClaw UNCONFIGURED (add a model in the UI)."
  OPENCLAW_JSON="$(jq -n --arg pw "$GW_PASSWORD" \
    '{ gateway: { auth: { password: $pw }, remote: { password: $pw },
                  controlUi: { dangerouslyAllowHostHeaderOriginFallback: true } } }')"
fi
OCB64="$(printf '%s' "$OPENCLAW_JSON" | base64 -w0)"
ox sh -c "mkdir -p /sandbox/.openclaw && echo $OCB64 | base64 -d > /sandbox/.openclaw/openclaw.json" \
  || warn "Could not stage openclaw.json."
ox openclaw config validate >/dev/null 2>&1 && log "openclaw.json valid." || warn "openclaw config validate failed."

# --- seed the agent's identity (IDENTITY.md / SOUL.md / BOOTSTRAP.md) into the workspace ---
SEED_DIR="$REPO_ROOT/manifests/openclaw/workspace-seed"
if [[ -d "$SEED_DIR" ]]; then
  log "Seeding agent workspace identity files"
  for f in "$SEED_DIR"/*; do
    [[ -f "$f" ]] || continue
    b="$(base64 -w0 < "$f")"
    ox sh -c "mkdir -p /sandbox/workspace && echo $b | base64 -d > /sandbox/workspace/$(basename "$f")" || true
  done
fi

# --- start the OpenClaw gateway (Control UI + WebSocket) inside the sandbox ---
log "Starting the OpenClaw gateway on :${UI_PORT} (auth=password)"
ox sh -c "cd /sandbox && nohup openclaw gateway run --port ${UI_PORT} --bind lan --auth password --password '${GW_PASSWORD}' --allow-unconfigured >/sandbox/gateway.log 2>&1 & sleep 7; tail -5 /sandbox/gateway.log" \
  || warn "Could not start the OpenClaw gateway."

# --- expose the Control UI on the host via `openshell forward` (persistent systemd unit) ---
log "Installing openclaw-forward.service (openshell forward host:${UI_PORT} -> sandbox)"
RUN_USER="$(id -un)"; RUN_HOME="$HOME"
OPENSHELL_BIN="$(command -v openshell)"
sudo tee /etc/systemd/system/openclaw-forward.service >/dev/null <<UNIT
[Unit]
Description=OpenShell forward: host ${UI_PORT} -> OpenClaw agent '${AGENT}' Control UI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Environment=HOME=${RUN_HOME}
Environment=PATH=${RUN_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin
# Re-select the gateway each start (CLI state lives in \$HOME), then hold the forward open.
ExecStart=/bin/sh -c '${OPENSHELL_BIN} gateway select cluster >/dev/null 2>&1; exec ${OPENSHELL_BIN} forward start 0.0.0.0:${UI_PORT} ${AGENT}'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-forward.service >/dev/null 2>&1 || warn "Could not start openclaw-forward.service."
sleep 4

log "OpenClaw agent '${AGENT}' is a gateway-managed sandbox in namespace ${NS}:"
oc -n "$NS" get pod "$AGENT" 2>/dev/null || openshell sandbox list 2>/dev/null | head
UI_CODE="$(curl -sS -m6 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${UI_PORT}/" 2>/dev/null || echo 000)"
log "Control UI on host 127.0.0.1:${UI_PORT} -> HTTP ${UI_CODE}  (publish host port ${UI_PORT} as your Brev URL)"
log "Control UI password: ${GW_PASSWORD}  (first browser still needs device pairing approval)"
