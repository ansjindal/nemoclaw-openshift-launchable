import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Live agent activity for the Incident Lab: the recent SANDBOX logs of one agent — which
// include the governed network requests it makes (OCSF `NET:OPEN ALLOWED/DENIED host:port`)
// and its model/tool calls. Lets the UI show, while the fleet runs, what each agent is doing.

const HOME = process.env.HOME ?? "/home/ubuntu";
const env = { ...process.env, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };

function openshell(args: string[], timeoutMs = 10_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn("openshell", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
    c.on("error", () => { clearTimeout(t); resolve({ code: 1, out: "" }); });
  });
}

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) return NextResponse.json({ ok: false, error: "bad name" }, { status: 400 });
  // recent sandbox logs only (not --tail, which would stream forever); bounded + time-windowed.
  const r = await openshell(["logs", name, "-n", "80", "--source", "sandbox", "--since", "10m"]);
  const lines = r.out
    .split("\n")
    .filter((l) => l.trim() && !/UNDICI|trace-warn/.test(l))
    // tidy the OCSF/router noise into something readable, keep the signal (NET:OPEN/CLOSE, routing, tool)
    .map((l) => l.replace(/^\[\d+\.\d+\]\s*/, "").replace(/\[(sandbox|gateway)\]\s*/g, ""))
    .slice(-60);
  return NextResponse.json({ ok: r.code === 0, name, logs: lines.join("\n") });
}
