import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

// Live OpenShell data for the learning UI. The web server runs on the instance (as the
// same user that drives the lab), so it reads the gateway's state straight from the
// cluster + the openshell CLI. READ-ONLY, fixed commands; the only variable is a sandbox
// name, which we validate against a strict pattern and pass as an argv element (execFile,
// no shell) → nothing injectable.

const run = promisify(execFile);
const NS = "openshell";
const HOME = process.env.HOME ?? "/home/ubuntu";
const KUBECONFIG = process.env.KUBECONFIG || `${HOME}/nemoclaw-openshift-launchable/kubeconfig`;
const env = { ...process.env, KUBECONFIG, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const validName = (n: string) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(n);

// The OpenClaw agent that runs the gateway (device pairing/approvals live there).
const AGENT = process.env.OPENCLAW_AGENT_NAME || "shifty";
const UI_PORT = process.env.OPENCLAW_UI_PORT || "30789";
const validReqId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Gateway password for `openclaw devices approve|reject` (env first, then the repo .env,
// then the workshop default). Never surfaced to the client.
function gwPassword(): string {
  if (process.env.OPENCLAW_GATEWAY_PASSWORD) return process.env.OPENCLAW_GATEWAY_PASSWORD;
  try {
    const m = /^\s*OPENCLAW_GATEWAY_PASSWORD\s*=\s*["']?([^"'\n#]+)/m.exec(readFileSync(`${HOME}/nemoclaw-openshift-launchable/.env`, "utf8"));
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  return "openshell-wad26";
}

// Pending device-pairing requests for the agent's gateway, read straight from the gateway's
// on-disk request table (clean JSON) inside the sandbox — no fragile CLI-table parsing.
type Pending = { requestId: string; deviceId: string; roles: string[]; scopes: string[]; isRepair: boolean; ts: number | null };
async function pendingApprovals(): Promise<Pending[]> {
  if (!validName(AGENT)) return [];
  const { stdout } = await run("openshell",
    ["sandbox", "exec", "-n", AGENT, "--", "cat", "/sandbox/.openclaw/devices/pending.json"],
    { env, timeout: 8000, maxBuffer: 1 << 20 });
  const start = stdout.indexOf("{");
  if (start < 0) return [];
  const obj = JSON.parse(stdout.slice(start)) as Record<string, Record<string, unknown>>;
  return Object.values(obj)
    .map((r) => ({
      requestId: String(r.requestId ?? ""), deviceId: String(r.deviceId ?? ""),
      roles: Array.isArray(r.roles) ? (r.roles as string[]) : [],
      scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
      isRepair: !!r.isRepair, ts: typeof r.ts === "number" ? r.ts : null,
    }))
    .filter((r) => r.requestId);
}

async function oc(args: string[]) {
  const { stdout } = await run("oc", ["-n", NS, ...args], { env, timeout: 8000, maxBuffer: 4 << 20 });
  return JSON.parse(stdout);
}
async function openshell(args: string[]) {
  const { stdout } = await run("openshell", args, { env, timeout: 10000, maxBuffer: 4 << 20 });
  return stdout;
}
async function openshellJson(args: string[]) {
  const { stdout } = await run("openshell", args, { env, timeout: 10000, maxBuffer: 4 << 20 });
  return JSON.parse(stdout);
}

// The gateway's inference route (active provider + model) and the registered providers.
// `provider list -o json` exposes only the credential/config KEY NAMES — never the secret
// values — so this is safe to surface read-only in the UI.
type Provider = { name: string; type: string; credential_keys?: string[]; config_keys?: string[] };
async function getInference() {
  const [routeText, providers] = await Promise.all([
    openshell(["inference", "get"]).catch(() => ""),
    openshellJson(["provider", "list", "-o", "json"]).catch(() => [] as Provider[]),
  ]);
  const gw = routeText.replace(/\x1b\[[0-9;]*m/g, "").split(/System inference:/i)[0];
  const provider = /Provider:\s*(\S+)/.exec(gw)?.[1] ?? null;
  const model = /Model:\s*(\S+)/.exec(gw)?.[1] ?? null;
  const version = /Version:\s*(\S+)/.exec(gw)?.[1] ?? null;
  return {
    configured: !!(provider && model),
    provider, model, version,
    providers: (providers as Provider[]).map((p) => ({
      name: p.name, type: p.type,
      credentialKeys: p.credential_keys ?? [], configKeys: p.config_keys ?? [],
    })),
  };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const logsFor = url.searchParams.get("logs");
  const policyFor = url.searchParams.get("policy");

  try {
    // --- per-sandbox logs (the gateway/sandbox audit + egress feed) ---
    if (logsFor) {
      if (!validName(logsFor)) return NextResponse.json({ ok: false, error: "bad name" });
      const src = url.searchParams.get("source") ?? "all";
      const source = ["gateway", "sandbox", "all"].includes(src) ? src : "all";
      const out = await openshell(["logs", logsFor, "-n", "120", "--source", source]).catch((e) => `(${e instanceof Error ? e.message : e})`);
      return NextResponse.json({ ok: true, name: logsFor, source, text: out });
    }

    // --- per-sandbox effective policy (full YAML: filesystem, process, network rules) ---
    if (policyFor) {
      if (!validName(policyFor)) return NextResponse.json({ ok: false, error: "bad name" });
      const out = await openshell(["policy", "get", policyFor, "--full"]).catch((e) => `(${e instanceof Error ? e.message : e})`);
      return NextResponse.json({ ok: true, name: policyFor, text: out });
    }

    // --- default: gateway health + the sandbox fleet + the inference route + pending approvals ---
    const [sb, pods, inference, pending] = await Promise.all([
      oc(["get", "sandboxes.agents.x-k8s.io", "-o", "json"]).catch(() => ({ items: [] })),
      oc(["get", "pods", "-o", "json"]).catch(() => ({ items: [] })),
      getInference().catch(() => null),
      pendingApprovals().catch(() => [] as Pending[]),
    ]);
    type Pod = { metadata: { name: string }; status?: { phase?: string; containerStatuses?: { ready?: boolean; restartCount?: number }[] } };
    const podByName = new Map<string, Pod>();
    for (const p of (pods.items ?? []) as Pod[]) podByName.set(p.metadata.name, p);
    type SB = { metadata: { name: string; creationTimestamp?: string }; status?: { phase?: string } };
    const sandboxes = ((sb.items ?? []) as SB[]).map((s) => {
      const pod = podByName.get(s.metadata.name);
      const cs = pod?.status?.containerStatuses ?? [];
      return {
        name: s.metadata.name,
        phase: s.status?.phase || pod?.status?.phase || "—",
        ready: cs.length ? cs.every((c) => c.ready) : false,
        restarts: cs.reduce((n, c) => n + (c.restartCount ?? 0), 0),
        created: s.metadata.creationTimestamp ?? null,
      };
    });
    let gateway = { ready: false, version: null as string | null };
    try {
      const ss = await oc(["get", "statefulset", "openshell", "-o", "json"]);
      gateway.ready = (ss.status?.readyReplicas ?? 0) >= 1;
      const img: string = ss.spec?.template?.spec?.containers?.[0]?.image ?? "";
      const m = /gateway:(\S+)/.exec(img);
      gateway.version = m ? m[1] : null;
    } catch {}
    return NextResponse.json({ ok: true, gateway, sandboxes, inference, pending, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// Approve / reject a pending device-pairing request. The ONLY write action this route
// exposes: fixed argv (execFile, no shell), action restricted to approve|reject, requestId
// validated as a UUID, gateway password injected server-side (never from the client).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = body?.action;
    const requestId = body?.requestId;
    if (action !== "approve" && action !== "reject")
      return NextResponse.json({ ok: false, error: "action must be approve|reject" }, { status: 400 });
    if (typeof requestId !== "string" || !validReqId(requestId))
      return NextResponse.json({ ok: false, error: "invalid requestId" }, { status: 400 });
    const { stdout, stderr } = await run("openshell",
      ["sandbox", "exec", "-n", AGENT, "--", "openclaw", "devices", action, requestId,
        "--url", `ws://127.0.0.1:${UI_PORT}`, "--password", gwPassword(), "--timeout", "8000"],
      { env, timeout: 14000, maxBuffer: 2 << 20 });
    const out = (stdout + stderr).replace(/\x1b\[[0-9;]*m/g, "").split("\n")
      .filter((l) => l.trim() && !/UNDICI|trace-warn|node --trace/.test(l)).slice(-4).join("\n");
    return NextResponse.json({ ok: true, action, requestId, output: out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
