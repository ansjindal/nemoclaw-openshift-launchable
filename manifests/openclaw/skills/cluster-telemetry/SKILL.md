---
name: cluster-telemetry
description: Use to read this SRE agent's in-cluster observability backend (Loki, Prometheus, or Tempo). The web_fetch tool is blocked for internal/cluster hosts, so use this skill whenever you must read real logs, metrics, or traces during an incident.
user-invocable: false
---

# Cluster Telemetry

Your telemetry backend lives on a cluster-internal address (`*.svc.cluster.local`), so the
`web_fetch` tool will refuse it and the gateway tools (`dir_list` / `node.list`) are not for
this — ignore them. Use the bundled query script via the `exec` tool instead.

## How to query

Call `exec` to run **one** query:

    node /sandbox/.agents/skills/cluster-telemetry/tq.js '<full-backend-url>'

It uses `curl` (an egress-allowed binary) to fetch the URL — so the call is still governed by
your single-backend egress policy — and prints a **compact** summary (a few lines) so you stay
focused. Your exact backend URL and the query to run are in your SOUL.

## Rules

- Run the **one** query that directly answers the incident. Do not loop through many queries,
  and do not read files or use other tools.
- Report the concrete values it prints — metric numbers, waiting reasons, log lines, trace
  counts. **Never invent data.**
- If it prints `ERR …`, report that error verbatim and stop.
