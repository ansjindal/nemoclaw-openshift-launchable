import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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

async function oc(args: string[]) {
  const { stdout } = await run("oc", ["-n", NS, ...args], { env, timeout: 8000, maxBuffer: 4 << 20 });
  return JSON.parse(stdout);
}
async function openshell(args: string[]) {
  const { stdout } = await run("openshell", args, { env, timeout: 10000, maxBuffer: 4 << 20 });
  return stdout;
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

    // --- per-sandbox effective-policy metadata ---
    if (policyFor) {
      if (!validName(policyFor)) return NextResponse.json({ ok: false, error: "bad name" });
      const out = await openshell(["policy", "get", policyFor]).catch((e) => `(${e instanceof Error ? e.message : e})`);
      return NextResponse.json({ ok: true, name: policyFor, text: out });
    }

    // --- default: gateway health + the sandbox fleet ---
    const [sb, pods] = await Promise.all([
      oc(["get", "sandboxes.agents.x-k8s.io", "-o", "json"]).catch(() => ({ items: [] })),
      oc(["get", "pods", "-o", "json"]).catch(() => ({ items: [] })),
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
    return NextResponse.json({ ok: true, gateway, sandboxes, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
