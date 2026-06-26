#!/usr/bin/env bash
# Phase 50 — publish MicroShift NodePorts on the host.
#
# Why this exists: MicroShift runs *inside* the MINC podman container, which only
# publishes the router/API ports (80->9080, 443->9443, 6443). `minc create` has no
# flag to publish arbitrary ports, and you can't add ports to an already-running
# container — so NodePorts (e.g. OpenClaw 30789, console 30900) live on the node
# inside the container and are NOT reachable on the host (or via a Brev URL, which
# maps a *host* port). The MINC node's bridge IP *is* routable from the host, so we
# install a systemd service that forwards host:<port> -> <node-ip>:<port> with socat.
# It re-resolves the node IP on start and bails if the IP changes, so systemd restarts
# it and it self-heals across container restarts/reboots.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
load_env

ENGINE="${CONTAINER_ENGINE:-podman}"
NODE_CTR="${MINC_NODE_CONTAINER:-microshift}"
# 0.0.0.0 so a Brev URL / remote client can reach it. NOTE: the console NodePort
# fronts an UNAUTHENTICATED admin console — only acceptable on an ephemeral workshop
# instance. Set NODEPORT_BIND_ADDR=127.0.0.1 to restrict to loopback + SSH tunnels.
BIND_ADDR="${NODEPORT_BIND_ADDR:-0.0.0.0}"
# Space-separated NodePorts to publish. 30789 = OpenClaw UI, 30900 = console (optional
# phase 60), 30808 = OpenShell gateway gRPC (so the workshop shell's `openshell` CLI has a
# stable endpoint). A listener for an undeployed NodePort is harmless (no backend = refused).
PORTS="${NODEPORT_FORWARDS:-30789 30900 30808}"

require_cmd "$ENGINE"
# The MINC container may live in the rootless or the rootful store; pick whichever can
# actually see it (rootless 'podman info' can succeed even when the container is rootful).
SUDO=""
if ! $ENGINE inspect "$NODE_CTR" >/dev/null 2>&1; then
  if sudo $ENGINE inspect "$NODE_CTR" >/dev/null 2>&1; then SUDO="sudo"; else
    die "MINC node container '$NODE_CTR' not found in rootless or rootful $ENGINE — run phase 20 first."
  fi
fi

if ! command -v socat >/dev/null 2>&1; then
  log "Installing socat (host port forwarder)"
  sudo apt-get update -y && sudo apt-get install -y socat
fi

log "Installing /usr/local/bin/minc-nodeport-forward.sh"
sudo tee /usr/local/bin/minc-nodeport-forward.sh >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
# Forwards host NodePorts to the MINC node container's bridge IP. Re-resolves the IP
# on start; exits (so systemd restarts us) if the IP changes or any forwarder dies.
set -uo pipefail
ENGINE="${CONTAINER_ENGINE:-podman}"
NODE_CTR="${MINC_NODE_CONTAINER:-microshift}"
BIND_ADDR="${NODEPORT_BIND_ADDR:-0.0.0.0}"
PORTS="${NODEPORT_FORWARDS:-30789 30900}"

node_ip() { "$ENGINE" inspect "$NODE_CTR" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || true; }

IP=""
for _ in $(seq 1 60); do IP="$(node_ip)"; [[ -n "$IP" ]] && break; sleep 2; done
[[ -n "$IP" ]] || { echo "[forward] node container '$NODE_CTR' has no IP yet"; exit 1; }

echo "[forward] publishing ${BIND_ADDR} ports [${PORTS}] -> ${IP}"
pids=()
for p in $PORTS; do
  socat "TCP-LISTEN:${p},bind=${BIND_ADDR},fork,reuseaddr" "TCP:${IP}:${p}" &
  pids+=($!)
done
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT

while :; do
  sleep 10
  [[ "$(node_ip)" == "$IP" ]] || { echo "[forward] node IP changed; restarting"; exit 1; }
  for pid in "${pids[@]}"; do kill -0 "$pid" 2>/dev/null || { echo "[forward] a forwarder exited; restarting"; exit 1; }; done
done
SCRIPT
sudo chmod +x /usr/local/bin/minc-nodeport-forward.sh

log "Installing systemd unit minc-nodeport-forward.service"
sudo tee /etc/systemd/system/minc-nodeport-forward.service >/dev/null <<UNIT
[Unit]
Description=MINC NodePort host forwarder (publishes MicroShift NodePorts on the host)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=CONTAINER_ENGINE=${ENGINE}
Environment=MINC_NODE_CONTAINER=${NODE_CTR}
Environment=NODEPORT_BIND_ADDR=${BIND_ADDR}
# Quoted: systemd treats an unquoted space in Environment= as a separator between
# assignments, which would drop all NodePorts after the first.
Environment="NODEPORT_FORWARDS=${PORTS}"
ExecStart=/usr/local/bin/minc-nodeport-forward.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now minc-nodeport-forward.service
sudo systemctl restart minc-nodeport-forward.service

sleep 2
log "Verifying host reachability:"
for p in $PORTS; do
  code="$(curl -sS -m5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${p}/" 2>/dev/null || echo 000)"
  log "  host 127.0.0.1:${p} -> HTTP ${code}"
done
log "NodePorts published on the host. Expose host ports ${PORTS} as your URL(s)."
