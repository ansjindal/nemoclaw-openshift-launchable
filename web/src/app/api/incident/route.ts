import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Part VI capstone — the Incident Lab. Drives a sample app so the fleet can be TESTED on
// a real (injected) incident: deploy it, break it (a fault you'd normally ship by mistake),
// report health, and revert the fault — the revert is gated by an explicit human action in
// the UI. The agents only DIAGNOSE (read-only telemetry, sealed from the k8s API); the
// human + this route APPLY the change. In production the break/fix is a git commit ArgoCD syncs.

const HOME = process.env.HOME ?? "/home/ubuntu";
const KUBECONFIG = process.env.KUBECONFIG || `${HOME}/.kube/config`;
const env = { ...process.env, KUBECONFIG, PATH: `${process.env.PATH ?? ""}:/usr/local/bin:/usr/bin` };
const NS = "demo", DEPLOY = "shop", CONTAINER = "web";
const GOOD = "nginxinc/nginx-unprivileged:stable";
const BAD = "nginxinc/nginx-unprivileged:v0-does-not-exist";
const MANIFEST = `${HOME}/nemoclaw-openshift-launchable/manifests/openclaw/demo-app.yaml`;

function kubectl(args: string[], timeoutMs = 60_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn("kubectl", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out: out.trim() }); });
    c.on("error", (e) => { clearTimeout(t); resolve({ code: 1, out: String(e) }); });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function health() {
  // readyReplicas / updatedReplicas / desired — a rolling update means old pods keep
  // serving (readyReplicas stays up) while the new ReplicaSet fails, so we also check
  // updatedReplicas and pod waiting reasons to catch a STUCK rollout.
  const d = await kubectl(["-n", NS, "get", "deploy", DEPLOY, "-o",
    "jsonpath={.status.readyReplicas}/{.status.updatedReplicas}/{.spec.replicas}"]);
  const [r, updated, want] = (d.out || "0/0/0").split("/").map((n) => parseInt(n, 10) || 0);
  const pods = await kubectl(["-n", NS, "get", "pods", "-l", `app=${DEPLOY}`, "-o",
    "jsonpath={range .items[*]}{.metadata.name}{'='}{.status.phase}{','}{range .status.containerStatuses[*]}{.state.waiting.reason}{end}{'\\n'}{end}"]);
  const stuck = /ImagePullBackOff|ErrImagePull|CrashLoopBackOff|CreateContainerError/.test(pods.out);
  return { exists: d.code === 0, ready: `${r}/${want}`, healthy: d.code === 0 && want > 0 && r >= want && updated >= want && !stuck, pods: pods.out };
}

export async function GET() {
  return NextResponse.json({ ok: true, ...(await health()) });
}

export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({}));
  try {
    if (action === "deploy") {
      const a = await kubectl(["apply", "-f", MANIFEST]);
      await kubectl(["-n", NS, "rollout", "status", `deploy/${DEPLOY}`, "--timeout=90s"]);
      return NextResponse.json({ ok: a.code === 0, action, out: a.out, ...(await health()) });
    }
    if (action === "break") {
      const a = await kubectl(["-n", NS, "set", "image", `deploy/${DEPLOY}`, `${CONTAINER}=${BAD}`]);
      await sleep(8000); // let the new ReplicaSet try (and fail) to pull before reporting
      return NextResponse.json({ ok: a.code === 0, action, note: "bad image tag injected — the rollout can't complete", out: a.out, ...(await health()) });
    }
    if (action === "fix") {
      const a = await kubectl(["-n", NS, "set", "image", `deploy/${DEPLOY}`, `${CONTAINER}=${GOOD}`]);
      await kubectl(["-n", NS, "rollout", "status", `deploy/${DEPLOY}`, "--timeout=90s"]);
      return NextResponse.json({ ok: a.code === 0, action, out: a.out, ...(await health()) });
    }
    if (action === "teardown") {
      const a = await kubectl(["delete", "-f", MANIFEST, "--ignore-not-found"]);
      return NextResponse.json({ ok: a.code === 0, action, out: a.out });
    }
    return NextResponse.json({ ok: false, error: "action must be deploy|break|fix|teardown" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
