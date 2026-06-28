# Custom OpenClaw sandbox image = the community sandbox image + a newer OpenClaw.
#
# Why: the DuckDuckGo web-search plugin (key-free) needs OpenClaw >= 2026.6.x, which in
# turn needs Node >= 22.19. The community base already ships Node 22.22, so we only need
# to npm-upgrade the bundled OpenClaw — everything else (iproute2, the sandbox runtime,
# the OpenClaw agent) is inherited unchanged.
#
# Build + publish via .github/workflows/build-openclaw-sandbox.yml (pushes to
# ghcr.io/<owner>/openclaw-sandbox:<version>), then pin OPENCLAW_SANDBOX_IMAGE to it.
ARG BASE=ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest
FROM ${BASE}

ARG OPENCLAW_VERSION=2026.6.10

USER root
RUN npm install -g "openclaw@${OPENCLAW_VERSION}" \
 && node --version \
 && openclaw --version
