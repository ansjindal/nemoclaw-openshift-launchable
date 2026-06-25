#!/bin/bash
# Brev Launchable lifecycle wrapper.
# Locate the cloned repo, capture the Launchable env-config vars into .env, run the full
# provision, and tee the output. Deliberately robust: NO `set -e`, and the repo `find`
# can't kill the script (a bare `set -euo pipefail` + `find /root` permission-denied is
# what made earlier runs fail with "error, 0 logs").
set -uo pipefail

echo "[brev-setup] locating repo..."
REPO="$(find "$HOME" /home /workspace . -maxdepth 5 -type d -name nemoclaw-openshift-launchable 2>/dev/null | head -1 || true)"
if [ -z "${REPO:-}" ]; then
  echo "[brev-setup] ERROR: repo 'nemoclaw-openshift-launchable' not found under \$HOME /home /workspace"
  ls -la "$HOME" || true
  exit 1
fi
cd "$REPO"
echo "[brev-setup] repo: $REPO"
chmod +x scripts/*.sh 2>/dev/null || true

# Launchable env-config vars (Step 5) are injected as env vars; capture them into .env so
# setup.sh reads them deterministically. Model creds are OPTIONAL — without them the agent
# deploys unconfigured and the user adds a provider/model/key in the OpenClaw UI.
cat > .env <<EOF
CONTAINER_ENGINE=${CONTAINER_ENGINE:-podman}
NEMOCLAW_INFERENCE_BASE_URL=${NEMOCLAW_INFERENCE_BASE_URL:-}
NEMOCLAW_MODEL=${NEMOCLAW_MODEL:-}
NEMOCLAW_API_KEY=${NEMOCLAW_API_KEY:-}
OPENCLAW_GATEWAY_PASSWORD=${OPENCLAW_GATEWAY_PASSWORD:-openshell-wad26}
DEPLOY_CONSOLE=${DEPLOY_CONSOLE:-true}
EOF

echo "[brev-setup] running setup.sh (live; also saved to \$HOME/setup.log) ..."
# FOREGROUND + line-buffered: the Brev "Script Logs" panel reads our stdout through a pipe,
# which block-buffers by default and makes the panel look empty until the very end. stdbuf
# forces line buffering so each phase's progress streams live. (We run foreground, not
# detached, precisely so you can watch progress in the UI without SSH.)
stdbuf -oL -eL ./scripts/setup.sh 2>&1 | stdbuf -oL tee "$HOME/setup.log"
rc=${PIPESTATUS[0]}
echo "[brev-setup] setup.sh exit code: $rc"
[ "$rc" -eq 0 ] && echo "[brev-setup] ✅ stack up — open the openclaw / openshift tunnels." \
               || echo "[brev-setup] ❌ failed (rc=$rc) — see the log above or \$HOME/setup.log."
exit "$rc"
