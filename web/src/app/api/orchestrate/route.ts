import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

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
  const out = await openshell(["sandbox", "exec", "-n", agent, "--", "openclaw", "agent", "--local", "--json", "-m", subtask]);
  const clean = out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l));
  const j = clean.reverse().find((l) => l.trim().startsWith("{"));
  if (j) { try { const o = JSON.parse(j); return o.reply ?? o.text ?? j; } catch { /* fall through */ } }
  return clean.reverse().join("\n").trim().slice(0, 4000);
}

export async function POST(req: Request) {
  try {
    const { task } = await req.json();
    if (!task || typeof task !== "string") return NextResponse.json({ ok: false, error: "task required" }, { status: 400 });

    const planRaw = await complete([
      { role: "system", content: `You are an orchestrator. Break the task into 1-4 ordered steps. Route each to ONE agent from: ${FLEET.join(", ")}. Reply JSON: {"steps":[{"agent":"...","subtask":"..."}]}` },
      { role: "user", content: task },
    ], true);
    const steps: { agent: string; subtask: string }[] = JSON.parse(planRaw).steps ?? [];

    const results = [];
    for (const s of steps) results.push({ ...s, out: await runAgent(s.agent, s.subtask) });

    const answer = await complete([
      { role: "system", content: "Synthesize the agents' results into one clear answer for the user." },
      { role: "user", content: `Task: ${task}\n\n${results.map((r) => `## ${r.agent}\n${r.out}`).join("\n\n")}` },
    ]);

    return NextResponse.json({ ok: true, fleet: FLEET, plan: steps, results, answer });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, fleet: FLEET, hint: "POST { task } to plan → dispatch to the fleet → synthesize" });
}
