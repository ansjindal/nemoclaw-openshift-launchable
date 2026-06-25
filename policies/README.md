# OpenClaw sandbox policies

Declarative policy for the OpenClaw agent running in the OpenShell sandbox. NemoClaw runs
**deny-by-default**: the agent can only reach endpoints listed here, only via the listed
binaries, and can only write to the listed filesystem paths.

## Files

| File | Purpose |
|------|---------|
| [`openclaw-sandbox.yaml`](openclaw-sandbox.yaml) | Main sandbox policy (authoring format). **Balanced** tier. |
| [`openclaw-sandbox.json`](openclaw-sandbox.json) | Same policy in JSON (for tooling / the `sandbox-policy.schema.json` validator). |
| [`presets/github.yaml`](presets/github.yaml) | Example hot-add preset. |

Keep the two main files in sync. To regenerate the JSON from the YAML:

```bash
python3 -c "import yaml,json,sys; json.dump(yaml.safe_load(open('openclaw-sandbox.yaml')), sys.stdout, indent=2)" > openclaw-sandbox.json
```

## Schema (per endpoint group)

```yaml
network_policies:
  - name: <unique id>                 # e.g. github, pypi
    endpoints:
      - host: <fqdn>
        port: <int>
        protocol: rest | websocket
        enforcement: enforce          # L7 inspect methods/paths …
        # access: full                # … OR L4 tunnel (package managers); omit rules
    binaries:                         # REQUIRED — stops exfil via curl/wget
      - /usr/bin/node
    rules:                            # required unless access: full
      - method: GET | POST | PUT | PATCH | DELETE   # wildcard '*' is forbidden
        path: /api/**                 # glob; /** = all subpaths
```

Static, creation-locked sections (changing them recreates the sandbox):

```yaml
filesystem:
  read_write: [/sandbox, /tmp]
  read_only:  [/usr, /etc, /lib, /bin]
process:
  allowed_binaries: [/usr/bin/node, /bin/bash, ...]
```

## Tiers

| Tier | Presets on top of baseline |
|------|----------------------------|
| Restricted | none (baseline only) |
| **Balanced** (this file) | npm, pypi, huggingface, brew, brave |
| Open | npm, pypi, slack, discord, telegram, jira, outlook |

Baseline always allows: remote **inference**, **ClawHub**, **OpenClaw** API/docs, **npm**.

> ⚠️ Set the `inference` group's `host` to match `NEMOCLAW_INFERENCE_BASE_URL` in `.env`.
> With no local GPU, all inference is remote — if that host isn't allowed, the agent can't think.

## Applying

- **At onboard (static):** phase `40-nemoclaw.sh` passes this file to `nemoclaw onboard`
  via `--policy policies/openclaw-sandbox.yaml`.
- **Live, non-destructive (network only):** `nemoclaw <sandbox-name> policy-add policies/presets/github.yaml`
- **Ad-hoc approval:** when the agent hits an unlisted host, an operator can approve it in
  `openshell term`, which adds it to the running session.
