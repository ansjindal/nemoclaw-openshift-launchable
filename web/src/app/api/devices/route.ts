import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

// Device-pairing approvals for the agent's OpenClaw gateway. A device (browser/CLI) that
// asks to pair lands in the gateway's pending table; an admin approves/denies. We read the
// table and act via `openclaw devices approve|reject` run through `openshell sandbox exec`.
//
// IMPORTANT: `openshell sandbox exec` opens an interactive session and does NOT exit until
// stdin reaches EOF. Under a piped child that leaves stdin open, it hangs forever — so we
// spawn with stdin "ignore" (immediate EOF) and capture stdout. The phase-45 admin
// bootstrap is what lets the operator approve at all. (Egress access-requests: /api/drafts.)
const HOME = process.env.HOME ?? "/home/ubuntu";
const KUBECONFIG = process.env.KUBECONFIG || `${HOME}/nemoclaw-openshift-launchable/kubeconfig`;
const env = { ...process.env, KUBECONFIG, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const AGENT = process.env.OPENCLAW_AGENT_NAME || "shifty";
const UI_PORT = process.env.OPENCLAW_UI_PORT || "30789";
const validName = (n: string) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(n);
const validReqId = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function gwPassword(): string {
  if (process.env.OPENCLAW_GATEWAY_PASSWORD) return process.env.OPENCLAW_GATEWAY_PASSWORD;
  try {
    const m = /^\s*OPENCLAW_GATEWAY_PASSWORD\s*=\s*["']?([^"'\n#]+)/m.exec(readFileSync(`${HOME}/nemoclaw-openshift-launchable/.env`, "utf8"));
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  return "openshell-wad26";
}

// Run `openshell …` with stdin closed (so `sandbox exec` gets EOF and exits) + capture stdout.
function openshell(args: string[], timeoutMs = 12000): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const c = spawn("openshell", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", (d) => { out += d; });
    c.stderr.on("data", (d) => { err += d; });
    const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch { /* noop */ } reject(new Error("openshell timed out")); }, timeoutMs);
    c.on("error", (e) => { clearTimeout(t); reject(e); });
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}

function parseObj(s: string): Record<string, Record<string, unknown>> {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) return {};
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return {}; }
}

export const dynamic = "force-dynamic";

export async function GET() {
  if (!validName(AGENT)) return NextResponse.json({ ok: false, error: "bad agent", pending: [] });
  try {
    const { out } = await openshell(["sandbox", "exec", "-n", AGENT, "--", "cat", "/sandbox/.openclaw/devices/pending.json"], 12000);
    const pending = Object.values(parseObj(out)).map((r) => ({
      requestId: String(r.requestId ?? ""), deviceId: String(r.deviceId ?? ""),
      roles: Array.isArray(r.roles) ? (r.roles as string[]) : [],
      scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
      isRepair: !!r.isRepair, ts: typeof r.ts === "number" ? r.ts : null,
    })).filter((r) => r.requestId);
    return NextResponse.json({ ok: true, pending });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), pending: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = body?.action;
  const requestId = body?.requestId;
  if (action !== "approve" && action !== "reject")
    return NextResponse.json({ ok: false, error: "action must be approve|reject" }, { status: 400 });
  if (!validReqId(requestId))
    return NextResponse.json({ ok: false, error: "invalid requestId" }, { status: 400 });
  try {
    const { out, err } = await openshell(
      ["sandbox", "exec", "-n", AGENT, "--", "openclaw", "devices", action, requestId as string,
        "--url", `ws://127.0.0.1:${UI_PORT}`, "--password", gwPassword(), "--timeout", "8000"], 16000);
    const text = (out + err).replace(/\x1b\[[0-9;]*m/g, "").split("\n")
      .filter((l) => l.trim() && !/UNDICI|trace-warn|node --trace/.test(l)).slice(-4).join("\n");
    return NextResponse.json({ ok: true, action, output: text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
