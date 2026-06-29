import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Part VI capstone, in the website: an orchestrator that uses the completions API to
// PLAN a task into agent-routed steps, DISPATCHES each step to a sealed specialist agent
// via `openclaw agent --local`, then SYNTHESIZES the results. A judge types a task in the
// browser (the <Orchestrator/> widget) and watches the fleet do the work — governed + audited.

const HOME = process.env.HOME ?? "/home/ubuntu";
const REPO = `${HOME}/nemoclaw-openshift-launchable`;
const KUBECONFIG = process.env.KUBECONFIG || `${REPO}/kubeconfig`;
const env = { ...process.env, NODE_NO_WARNINGS: "1", KUBECONFIG, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const FLEET = (process.env.FLEET || "logs,metrics,traces,writer").split(",").map((s) => s.trim()).filter(Boolean);

// Inference config: process.env first, else parse the repo .env (same approach as the
// devices route reads the gateway password). The host reaches the provider directly.
function envVal(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  try {
    const line = readFileSync(`${REPO}/.env`, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}

// Run `openshell …` with stdin closed so `sandbox exec` gets EOF and exits.
function openshell(args: string[], timeoutMs = 180_000): Promise<string> {
  return new Promise((resolve) => {
    const c = spawn("openshell", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", () => { clearTimeout(t); resolve(out); });
    c.on("error", (e) => { clearTimeout(t); resolve(`(dispatch error: ${e.message})`); });
  });
}

async function complete(messages: unknown[], json = false): Promise<string> {
  const base = envVal("NEMOCLAW_INFERENCE_BASE_URL").replace(/\/$/, "");
  const key = envVal("NEMOCLAW_PROVIDER_KEY") || envVal("NEMOCLAW_API_KEY");
  const model = envVal("NEMOCLAW_MODEL");
  if (!base || !model) throw new Error("inference not configured (NEMOCLAW_INFERENCE_BASE_URL / NEMOCLAW_MODEL)");
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages, temperature: 0.2, ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!r.ok) throw new Error(`completions ${r.status}`);
  return (await r.json()).choices?.[0]?.message?.content ?? "";
}

async function runAgent(agent: string, subtask: string): Promise<string> {
  // `openshell sandbox exec` rejects args containing newlines, and findings are multi-line —
  // so pass the message base64-encoded and decode it inside the sandbox via the shell.
  const b64 = Buffer.from(subtask, "utf8").toString("base64");
  const out = await openshell(["sandbox", "exec", "-n", agent, "--", "sh", "-c",
    `NODE_NO_WARNINGS=1 openclaw agent --local --json --session-id ${randomUUID()} -m "$(printf %s ${b64} | base64 -d)"`]);
  const clean = out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l));
  const j = clean.reverse().find((l) => l.trim().startsWith("{"));
  if (j) { try { const o = JSON.parse(j); return o.reply ?? o.text ?? j; } catch { /* fall through */ } }
  return clean.reverse().join("\n").trim().slice(0, 4000);
}

// Streams the run as newline-delimited JSON events so the UI shows a LIVE TIMELINE of each
// agent (start/done + duration) — and the long run never idles the connection out. The
// investigators run in PARALLEL; the writer agent synthesizes once they're all in.
export async function POST(req: Request) {
  const { task } = await req.json().catch(() => ({}));
  if (!task || typeof task !== "string") return NextResponse.json({ ok: false, error: "task required" }, { status: 400 });
  const SYNTH = "writer";
  const investigators = FLEET.filter((a) => a !== SYNTH);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const t0 = Date.now();
      const emit = (o: object) => controller.enqueue(enc.encode(JSON.stringify({ t: Date.now() - t0, ...o }) + "\n"));
      try {
        emit({ type: "plan-start", fleet: FLEET, investigators });
        const planRaw = await complete([
          { role: "system", content: `You are an orchestrator. Break the incident into 1-4 investigation steps. Route each to ONE agent from: ${investigators.join(", ")}. Reply JSON: {"steps":[{"agent":"...","subtask":"..."}]}` },
          { role: "user", content: task },
        ], true);
        const steps: { agent: string; subtask: string }[] = (JSON.parse(planRaw).steps ?? []).filter((s: { agent: string }) => investigators.includes(s.agent));
        emit({ type: "plan", steps });

        // dispatch investigators in PARALLEL; emit start now, done as each resolves
        steps.forEach((s) => emit({ type: "step", agent: s.agent, subtask: s.subtask, status: "start" }));
        const results = await Promise.all(steps.map(async (s) => {
          const st = Date.now();
          const out = await runAgent(s.agent, s.subtask);
          emit({ type: "step", agent: s.agent, status: "done", out, ms: Date.now() - st });
          return { ...s, out };
        }));

        // writer agent synthesizes
        const findings = results.map((r) => `## ${r.agent}\n${r.out}`).join("\n\n");
        emit({ type: "writer", status: "start" });
        const ws = Date.now();
        let answer = ""; let synthesizedBy = "completions";
        if (FLEET.includes(SYNTH)) {
          const w = await runAgent(SYNTH, `You are the incident writer. Combine the fleet's findings below into the ROOT CAUSE and a concrete RECOMMENDED FIX a human will approve.\n\nIncident: ${task}\n\n${findings}`);
          if (w && w.trim() && !/^\(.*(failed|error)/i.test(w.trim())) { answer = w; synthesizedBy = SYNTH; }
        }
        if (!answer) answer = await complete([
          { role: "system", content: "You are the incident writer. Combine the agents' findings into a root cause and a concrete recommended fix." },
          { role: "user", content: `Incident: ${task}\n\n${findings}` },
        ]);
        emit({ type: "answer", answer, synthesizedBy, ms: Date.now() - ws });
        emit({ type: "done" });
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
}

export async function GET() {
  return NextResponse.json({ ok: true, fleet: FLEET, hint: "POST { task } → streams plan → parallel agents → writer (NDJSON timeline)" });
}
