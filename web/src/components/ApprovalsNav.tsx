"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

// Header tab for device approvals, with a live count badge so a pending request is
// noticeable from anywhere in the workshop. Polls the read-only /api/openshell.
export function ApprovalsNav() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [dr, dv] = await Promise.all([
          fetch("/api/drafts", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/devices", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        ]);
        const chunks: { status?: string }[] = Array.isArray(dr?.chunks) ? dr.chunks : [];
        const access = chunks.filter((c) => (c.status || "pending") === "pending").length;
        const devs = Array.isArray(dv?.pending) ? dv.pending.length : 0;
        if (alive) setN(access + devs);
      } catch { /* ignore */ }
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <Link href="/approvals" title="Device approvals — approve or deny pairing requests"
      className="relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition hover:text-[var(--color-nv-bright)]"
      style={{ borderColor: n > 0 ? "#e0a800" : "var(--color-line-2)" }}>
      <ShieldCheck size={13} /> <span className="hidden sm:inline">Approvals</span>
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e0a800] px-1 text-[9px] font-bold text-[#06080b]">{n}</span>
      )}
    </Link>
  );
}
