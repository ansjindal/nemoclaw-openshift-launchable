import { NextResponse } from "next/server";
import { callGateway } from "@/lib/gateway-grpc";

// Draft-policy review for the agent's gateway: the egress destinations the agent was
// DENIED become proposed allow-rules ("draft chunks") the admin approves/rejects. This is
// the OpenShell gateway's gRPC DraftPolicy surface (the 0.0.71 CLI doesn't expose a `draft`
// verb, but the gateway implements the RPCs — same ones the OpenShell console calls).
const AGENT = process.env.OPENCLAW_AGENT_NAME || "shifty";
const validId = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const dynamic = "force-dynamic";

// GET → pending/decided draft chunks for the agent.
export async function GET() {
  try {
    const resp = await callGateway<Record<string, unknown>>("getDraftPolicy", { name: AGENT, statusFilter: "" });
    return NextResponse.json({ ok: true, ...resp });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// POST { action, chunkId?, reason? } → approve | reject | approve-all | undo | clear.
// Approving merges the proposed allow-rule into the live policy (agent may then reach it).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = body?.action;
  const chunkId = body?.chunkId;
  if (["approve", "reject", "undo"].includes(action as string) && !validId(chunkId))
    return NextResponse.json({ ok: false, error: "invalid chunkId" }, { status: 400 });
  try {
    let resp: unknown;
    switch (action) {
      case "approve": resp = await callGateway("approveDraftChunk", { name: AGENT, chunkId }); break;
      case "reject": resp = await callGateway("rejectDraftChunk", { name: AGENT, chunkId, reason: (body.reason as string) || "" }); break;
      case "approve-all": resp = await callGateway("approveAllDraftChunks", { name: AGENT, includeSecurityFlagged: !!body.includeSecurityFlagged }); break;
      case "undo": resp = await callGateway("undoDraftChunk", { name: AGENT, chunkId }); break;
      case "clear": resp = await callGateway("clearDraftChunks", { name: AGENT }); break;
      default: return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(resp as object) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
