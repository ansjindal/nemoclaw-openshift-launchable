import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

// Part VI capstone, in the website: an orchestrator that gives each sealed specialist agent
// an investigation step (in parallel, via `openclaw agent --local`), then a writer agent
// synthesizes their findings. The website never calls a model directly — the agents reach it
// through inference.local — so no host-side inference config is needed. Streams a live timeline.

const HOME = process.env.HOME ?? "/home/ubuntu";
const KUBECONFIG = process.env.KUBECONFIG || `${HOME}/.kube/config`;
const env = { ...process.env, NODE_NO_WARNINGS: "1", KUBECONFIG, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const FLEET = (process.env.FLEET || "logs,metrics,traces,writer").split(",").map((s) => s.trim()).filter(Boolean);

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

async function runAgent(agent: string, subtask: string): Promise<string> {
  // `openshell sandbox exec` rejects args containing newlines, and findings are multi-line —
  // so pass the message base64-encoded and decode it inside the sandbox via the shell.
  const b64 = Buffer.from(subtask, "utf8").toString("base64");
  const out = await openshell(["sandbox", "exec", "-n", agent, "--", "sh", "-c",
    `NODE_NO_WARNINGS=1 openclaw agent --local --json --session-id ${randomUUID()} -m "$(printf %s ${b64} | base64 -d)"`]);
  const raw = out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l)).join("\n");
  // openclaw --json prints a (multi-line) JSON object, e.g. {"payloads":[{"text":"…"}]},
  // amid log lines — pull the JSON blob and extract the agent's text.
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      const o = JSON.parse(raw.slice(a, b + 1));
      const txt = Array.isArray(o.payloads) ? o.payloads.map((p: { text?: string }) => p?.text).filter(Boolean).join("\n").trim() : (o.reply ?? o.text);
      if (txt && String(txt).trim()) return String(txt).trim();
    } catch { /* fall through */ }
  }
  const tm = /"text"\s*:\s*"([\s\S]*?)"\s*[},]/.exec(raw);
  if (tm) { try { return JSON.parse(`"${tm[1]}"`); } catch { return tm[1]; } }
  return raw.trim().slice(0, 4000);
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
        // Fixed plan: one investigation step per specialist. No host-side model call to plan —
        // the intelligence is in each agent's investigation + the writer's synthesis (both reach
        // the model via inference.local, so the website never needs direct model access).
        const steps: { agent: string; subtask: string }[] = investigators.map((a) => ({
          agent: a,
          subtask: `You are the ${a} specialist of an SRE fleet. Investigate this incident using ONLY your backend and report concrete findings as TEXT — actual values, log lines, metric numbers. Do NOT generate any image, picture, or media file.\n\nIncident: ${task}`,
        }));
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
        let answer = ""; let synthesizedBy = "writer";
        if (FLEET.includes(SYNTH)) {
          const w = await runAgent(SYNTH, `You are the incident writer — TEXT ONLY, do NOT generate any image, picture, or media file. Combine the fleet's findings below into the ROOT CAUSE and a concrete RECOMMENDED FIX a human will approve. Then end with exactly one line:\nRECOMMENDED_IMAGE: <the container image string deploy/shop should be set to, e.g. nginxinc/nginx-unprivileged:stable>\n\nIncident: ${task}\n\nFindings:\n${findings}`);
          if (w && w.trim() && !/^\(.*(failed|error)/i.test(w.trim())) answer = w;
        }
        if (!answer) { answer = `_(writer agent unavailable — raw findings below)_\n\n${findings}`; synthesizedBy = "raw"; }
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
