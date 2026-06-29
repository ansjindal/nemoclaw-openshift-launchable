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
  # Whitespace-separated columns:  name   backend(host:port|-)   skill(@scope/name|-)
  # (NOT colon-separated — backend hosts contain a colon, e.g. loki…:3100.)
  # Read the spec on FD 3 — the openshell commands below read stdin, and would otherwise
  # eat the rest of the spec file (so only the first agent would be created).
  while read -r name backend skill <&3; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    backend="${backend:--}"; skill="${skill:--}"
    echo "▶ ${name}  (egress=${backend}  skill=${skill})"
    local pf="/tmp/fleet-${name}.policy.yaml"; policy_for "$backend" > "$pf"
    openshell sandbox delete "$name" </dev/null >/dev/null 2>&1 || true; sleep 2
    echo "   creating sandbox from ${IMAGE}…"
    openshell sandbox create --name "$name" --policy "$pf" --from "$IMAGE" --no-tty -- true </dev/null >/tmp/fleet-${name}.log 2>&1 &
    local ready=false
    for i in $(seq 1 60); do
      sleep 5
      if openshell sandbox exec -n "$name" -- true </dev/null >/dev/null 2>&1; then ready=true; echo "   ✓ ready after $((i*5))s"; break; fi
      [[ $((i % 6)) -eq 0 ]] && echo "   …waiting for ${name} ($((i*5))s)"
    done
    if [[ "$ready" != true ]]; then
      echo "   ✗ ${name} not ready after 300s — create log:"; tail -8 "/tmp/fleet-${name}.log" 2>/dev/null | grep -viE 'UNDICI|trace-warn' | sed 's/^/       /'
      continue
    fi
    # stage the agent's persona (IDENTITY.md / SOUL.md) from fleet-roles/<name> — this is the role
    if [[ -d "$ROLES/$name" ]]; then
      for f in IDENTITY.md SOUL.md BOOTSTRAP.md; do
        [[ -f "$ROLES/$name/$f" ]] && ox "$name" "mkdir -p /sandbox && echo $(b64 < "$ROLES/$name/$f") | base64 -d > /sandbox/$f"
      done
      echo "   ✓ staged persona from fleet-roles/${name}"
    fi
    # model via inference.local (the gateway holds the real key)
    [[ -n "$MODEL" ]] && ox "$name" "mkdir -p /sandbox/.openclaw && echo $(printf '{"model":"%s","provider":"%s","baseUrl":"https://inference.local/v1"}' "$MODEL" "$PROVIDER" | b64) | base64 -d > /sandbox/.openclaw/openclaw.json"
    # optional: install a registry skill (a first-class tool for this role). Best-effort —
    # if the skill isn't published yet, the agent still works via its SOUL (curl/node).
    if [[ "$skill" != "-" && -n "$skill" ]]; then
      local auth; auth=$(printf 'workshop:%s' "${OPENCLAW_REGISTRY_PASSWORD:-wad26-skills}" | b64)
      ox "$name" "printf 'registry=http://${REG}/\n@workshop:registry=http://${REG}/\n//${REG}/:_auth=${auth}\n' > /sandbox/.npmrc"
      echo "   installing skill ${skill}…"
      ox "$name" "NODE_NO_WARNINGS=1 openclaw plugins install '$skill' 2>&1 | tail -1 | sed 's/^/     /'" || echo "     (skill install skipped — publish it first, or leave the skill column as '-')"
    fi
    echo "   ✓ ${name} ready"
  done 3< "$spec"
  echo "Done. Check './scripts/fleet.sh status' (or the Fleet page in the workshop)."
}

status() { openshell sandbox list 2>/dev/null | grep -viE 'UNDICI|trace-warn'; }
down()   { local s="${1:-}"; if [[ -n "$s" ]]; then awk '!/^#/ && NF{print $1}' "$s"; else openshell sandbox list 2>/dev/null | awk 'NR>1{print $1}'; fi | while read -r n; do [[ -n "$n" ]] && openshell sandbox delete "$n" >/dev/null 2>&1 && echo "removed $n"; done; }

case "${1:-}" in
  up) shift; up "$@" ;;
  status) status ;;
  down) shift; down "$@" ;;
  *) echo "usage: fleet.sh up <spec> | status | down [<spec>]"; exit 1 ;;
esac
