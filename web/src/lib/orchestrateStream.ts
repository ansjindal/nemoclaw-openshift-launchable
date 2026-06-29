// Consume the /api/orchestrate NDJSON stream (one JSON event per line) and hand each event
// to onEvent — used by the Orchestrator + Incident Lab widgets to render a live agent timeline.
export type OrchEvent = {
  t: number; type: string;
  fleet?: string[]; investigators?: string[];
  steps?: { agent: string; subtask: string }[];
  agent?: string; subtask?: string; status?: string; out?: string; ms?: number;
  answer?: string; synthesizedBy?: string; error?: string;
};

export async function streamOrchestrate(task: string, onEvent: (e: OrchEvent) => void): Promise<void> {
  const resp = await fetch("/api/orchestrate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task }),
  });
  // If the workshop is mid-rebuild/restart the server returns an HTML error page — surface a
  // clean message instead of letting JSON.parse choke on "<!DOCTYPE …".
  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok || !ct.includes("ndjson")) {
    throw new Error(`orchestrate unavailable (HTTP ${resp.status}${ct ? `, ${ct.split(";")[0]}` : ""}) — if the site just rebuilt, reload and try again`);
  }
  if (!resp.body) throw new Error(`no stream (${resp.status})`);
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) { try { onEvent(JSON.parse(line)); } catch { /* skip partial */ } }
    }
  }
}
