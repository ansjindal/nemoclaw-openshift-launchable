import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Part VI capstone — the fleet at a glance. For each agent: is it Ready, and exactly which
// egress its policy allows (proof that each agent's policy is specific to its tool).

const HOME = process.env.HOME ?? "/home/ubuntu";
const env = { ...process.env, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const FLEET = (process.env.FLEET || "logs,metrics,traces,writer").split(",").map((s) => s.trim()).filter(Boolean);
const ROLES: Record<string, string> = { logs: "Scout 🔎 — logs (Loki)", metrics: "Gauge 📈 — metrics (Prometheus)", traces: "Trace 🧵 — traces (Tempo)", writer: "Scribe ✍️ — synthesis (no egress)" };

function openshell(args: string[], timeoutMs = 12_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn("openshell", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
    c.on("error", () => { clearTimeout(t); resolve({ code: 1, out: "" }); });
  });
}

async function agentInfo(name: string) {
  // egress: parse the effective policy's network_policies endpoints
  const p = await openshell(["policy", "get", name, "--full", "-o", "json"]);
  let egress: string[] = []; let ready = false;
  try {
    const clean = p.out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l)).join("\n");
    const j = JSON.parse(clean.slice(clean.indexOf("{")));
    const nps = j.policy?.network_policies ?? {};
    for (const k of Object.keys(nps)) for (const e of nps[k].endpoints ?? []) egress.push(`${e.host}:${e.port}`);
    ready = true; // policy fetch succeeded → the sandbox exists and the gateway knows it
  } catch { /* not found / not ready */ }
  // liveness: a no-op exec
  const live = await openshell(["sandbox", "exec", "-n", name, "--", "true"], 8000);
  return { name, role: ROLES[name] ?? name, ready: ready && live.code === 0, egress };
}

export async function GET() {
  const agents = await Promise.all(FLEET.map(agentInfo));
  return NextResponse.json({ ok: true, agents });
}
