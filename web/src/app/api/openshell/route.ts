import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Live OpenShell data for the learning UI. The web server runs on the instance (as the
// same user that drives the lab), so it can read the gateway's state straight from the
// cluster. We use `oc ... -o json` because the openshell CLI has no --json output yet.
// READ-ONLY, fixed commands, no user input → nothing injectable.

const run = promisify(execFile);
const NS = "openshell";
const KUBECONFIG =
  process.env.KUBECONFIG || `${process.env.HOME ?? "/home/ubuntu"}/nemoclaw-openshift-launchable/kubeconfig`;
const env = { ...process.env, KUBECONFIG, PATH: `${process.env.PATH ?? ""}:/usr/local/bin:/usr/bin` };

async function oc(args: string[]) {
  const { stdout } = await run("oc", ["-n", NS, ...args], { env, timeout: 8000, maxBuffer: 4 << 20 });
  return JSON.parse(stdout);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Sandbox CRs (the agents) + their pods (for readiness/restarts).
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

    // Gateway health from its StatefulSet.
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
