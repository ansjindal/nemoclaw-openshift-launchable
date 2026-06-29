#!/usr/bin/env bash
# fleet.sh — Part VI capstone starter: bring up a fleet of SPECIALIST agents from a simple
# spec, so you never repeat the per-agent setup by hand. Each line of the spec file is:
#
#     name : skill : host          # skill/host may be "-" for none
#
# e.g.   reader   : @workshop/repo-reader : github.com
#        searcher : web-search            : duckduckgo.com
#        writer   : -                     : -
#
# For each agent this: creates a sealed sandbox with a deny-by-default policy that allows
# ONLY the in-cluster registry (+ that one host), stages the OpenClaw config (model via
# inference.local), installs the skill from your registry, and is ready for `openclaw agent`.
# Usage: ./scripts/fleet.sh up <spec>   |   status   |   down [<spec>]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
[[ -f "$REPO/.env" ]] && set -a && . "$REPO/.env" && set +a || true

IMAGE="${OPENCLAW_SANDBOX_IMAGE:-ghcr.io/ansjindal/openclaw-sandbox:2026.6.10}"
REGISTRY="${OPENCLAW_REGISTRY_HOST:-registry.openshell.svc.cluster.local:4873}"
MODEL="${NEMOCLAW_MODEL:-}"; PROVIDER="${NEMOCLAW_INFERENCE_PROVIDER:-default}"
ox() { openshell sandbox exec -n "$1" -- sh -c "$2" </dev/null 2>&1 | grep -viE 'UNDICI|trace-warn' || true; }
b64() { base64 | tr -d '\n'; }

policy_for() {            # $1=host (or "-")  -> a registry-only policy + optional one host
  local host="$1" extra=""
  [[ "$host" != "-" && -n "$host" ]] && extra="
  role-egress:
    name: role-egress
    endpoints: [ { host: ${host}, port: 443, access: full } ]
    binaries: [ {path: /usr/bin/node}, {path: /usr/local/bin/node} ]"
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
  while IFS=: read -r name skill host; do
    name="$(echo "$name" | xargs)"; skill="$(echo "$skill" | xargs)"; host="$(echo "$host" | xargs)"
    [[ -z "$name" || "$name" == \#* ]] && continue
    echo "▶ ${name}  (skill=${skill:- -}  egress=${host:- none})"
    local pf="/tmp/fleet-${name}.policy.yaml"; policy_for "$host" > "$pf"
    openshell sandbox delete "$name" >/dev/null 2>&1 || true; sleep 2
    openshell sandbox create --name "$name" --policy "$pf" --from "$IMAGE" --no-tty -- true >/tmp/fleet-${name}.log 2>&1 &
    for _ in $(seq 1 48); do sleep 5; openshell sandbox exec -n "$name" -- true >/dev/null 2>&1 && break; done
    # stage OpenClaw config (model via inference.local — the gateway holds the real key)
    if [[ -n "$MODEL" ]]; then
      local cfg; cfg=$(printf '{"model":"%s","provider":"%s","baseUrl":"https://inference.local/v1"}' "$MODEL" "$PROVIDER" | b64)
      ox "$name" "mkdir -p /sandbox/.openclaw && echo $cfg | base64 -d > /sandbox/.openclaw/openclaw.json"
    fi
    # point npm at the registry + install the skill
    local auth; auth=$(printf 'workshop:%s' "${OPENCLAW_REGISTRY_PASSWORD:-wad26-skills}" | b64)
    ox "$name" "printf 'registry=http://${REGISTRY}/\n@workshop:registry=http://${REGISTRY}/\n//${REGISTRY}/:_auth=${auth}\n' > /sandbox/.npmrc"
    [[ "$skill" != "-" && -n "$skill" ]] && ox "$name" "NODE_NO_WARNINGS=1 openclaw plugins install '$skill' 2>&1 | tail -1"
    echo "  ✓ ${name} ready"
  done < "$spec"
}

status() { openshell sandbox list 2>/dev/null | grep -viE 'UNDICI|trace-warn'; }
down()   { local spec="${1:-}"; if [[ -n "$spec" ]]; then awk -F: '!/^#/ && NF{gsub(/ /,"",$1);print $1}' "$spec"; else openshell sandbox list 2>/dev/null | awk 'NR>1{print $1}'; fi | while read -r n; do [[ -n "$n" ]] && openshell sandbox delete "$n" >/dev/null 2>&1 && echo "removed $n"; done; }

case "${1:-}" in
  up)     shift; up "$@" ;;
  status) status ;;
  down)   shift; down "$@" ;;
  *) echo "usage: fleet.sh up <spec> | status | down [<spec>]"; exit 1 ;;
esac
