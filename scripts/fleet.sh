#!/usr/bin/env bash
# fleet.sh — Part VI capstone: bring up the SRE copilot fleet from a simple spec, so you
# never repeat the per-agent setup by hand. Each line of the spec is:
#
#     name : backend            # backend = host:port the agent may reach, or "-" for none
#
# e.g.   logs    : loki.monitoring.svc.cluster.local:3100
#        metrics : kps-kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
#        traces  : tempo.monitoring.svc.cluster.local:3200
#        writer  : -
#
# For each agent this: creates a sealed sandbox whose deny-by-default policy allows ONLY
# that one telemetry backend (the egress is specific to the agent's tool), and stages the
# agent's IDENTITY.md / SOUL.md from manifests/openclaw/fleet-roles/<name>/ — so each agent
# has its own role and persona. Usage: ./scripts/fleet.sh up <spec> | status | down [<spec>]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
[[ -f "$REPO/.env" ]] && set -a && . "$REPO/.env" && set +a || true
IMAGE="${OPENCLAW_SANDBOX_IMAGE:-ghcr.io/ansjindal/openclaw-sandbox:2026.6.10}"
MODEL="${NEMOCLAW_MODEL:-}"; PROVIDER="${NEMOCLAW_INFERENCE_PROVIDER:-default}"
ROLES="$REPO/manifests/openclaw/fleet-roles"
ox() { openshell sandbox exec -n "$1" -- sh -c "$2" </dev/null 2>&1 | grep -viE 'UNDICI|trace-warn' || true; }
b64() { base64 | tr -d '\n'; }

policy_for() {                       # $1 = backend host:port (or "-")
  local be="$1" host="${1%%:*}" port="${1##*:}" extra=""
  [[ "$be" != "-" && -n "$be" ]] && extra="
  tool-egress:
    name: tool-egress
    endpoints: [ { host: ${host}, port: ${port}, access: full } ]
    binaries: [ {path: /usr/bin/node}, {path: /usr/local/bin/node}, {path: /usr/bin/curl} ]"
  cat <<YAML
version: 1
filesystem_policy: { include_workdir: true, read_only: [/usr,/lib,/proc,/dev/urandom,/app,/etc,/var/log], read_write: [/sandbox,/tmp,/dev/null] }
landlock: { compatibility: best_effort }
process: { run_as_user: sandbox, run_as_group: sandbox }
network_policies:
  in-cluster-registry:
    name: in-cluster-registry
    endpoints: [ { host: registry.openshell.svc.cluster.local, port: 4873, access: full, protocol: rest, allow_encoded_slash: true } ]
    binaries: [ {path: /usr/bin/npm}, {path: /usr/local/bin/npm}, {path: /usr/bin/node}, {path: /usr/local/bin/node} ]${extra}
YAML
}

up() {
  local spec="${1:?usage: fleet.sh up <spec>}"
  local REG="registry.openshell.svc.cluster.local:4873"
  while IFS=: read -r name backend skill; do
    name="$(echo "$name" | xargs)"; backend="$(echo "$backend" | xargs)"; skill="$(echo "$skill" | xargs)"
    [[ -z "$name" || "$name" == \#* ]] && continue
    echo "▶ ${name}  (egress=${backend:- none}  skill=${skill:- none})"
    local pf="/tmp/fleet-${name}.policy.yaml"; policy_for "$backend" > "$pf"
    openshell sandbox delete "$name" >/dev/null 2>&1 || true; sleep 2
    openshell sandbox create --name "$name" --policy "$pf" --from "$IMAGE" --no-tty -- true >/tmp/fleet-${name}.log 2>&1 &
    for _ in $(seq 1 48); do sleep 5; openshell sandbox exec -n "$name" -- true >/dev/null 2>&1 && break; done
    # stage the agent's persona (IDENTITY.md / SOUL.md / BOOTSTRAP.md) — this is the role
    if [[ -d "$ROLES/$name" ]]; then
      for f in IDENTITY.md SOUL.md BOOTSTRAP.md; do
        [[ -f "$ROLES/$name/$f" ]] && ox "$name" "mkdir -p /sandbox && echo $(b64 < "$ROLES/$name/$f") | base64 -d > /sandbox/$f"
      done
      echo "  ✓ staged persona from fleet-roles/${name}"
    fi
    # model via inference.local (the gateway holds the real key)
    if [[ -n "$MODEL" ]]; then
      ox "$name" "mkdir -p /sandbox/.openclaw && echo $(printf '{"model":"%s","provider":"%s","baseUrl":"https://inference.local/v1"}' "$MODEL" "$PROVIDER" | b64) | base64 -d > /sandbox/.openclaw/openclaw.json"
    fi
    # optional: install a registry skill (a first-class tool for this role) from the in-cluster registry
    if [[ "$skill" != "-" && -n "$skill" ]]; then
      local auth; auth=$(printf 'workshop:%s' "${OPENCLAW_REGISTRY_PASSWORD:-wad26-skills}" | b64)
      ox "$name" "printf 'registry=http://${REG}/\n@workshop:registry=http://${REG}/\n//${REG}/:_auth=${auth}\n' > /sandbox/.npmrc"
      ox "$name" "NODE_NO_WARNINGS=1 openclaw plugins install '$skill' 2>&1 | tail -1"
    fi
    echo "  ✓ ${name} ready"
  done < "$spec"
}

status() { openshell sandbox list 2>/dev/null | grep -viE 'UNDICI|trace-warn'; }
down()   { local s="${1:-}"; if [[ -n "$s" ]]; then awk -F: '!/^#/ && NF{gsub(/ /,"",$1);print $1}' "$s"; else openshell sandbox list 2>/dev/null | awk 'NR>1{print $1}'; fi | while read -r n; do [[ -n "$n" ]] && openshell sandbox delete "$n" >/dev/null 2>&1 && echo "removed $n"; done; }

case "${1:-}" in
  up) shift; up "$@" ;;
  status) status ;;
  down) shift; down "$@" ;;
  *) echo "usage: fleet.sh up <spec> | status | down [<spec>]"; exit 1 ;;
esac
