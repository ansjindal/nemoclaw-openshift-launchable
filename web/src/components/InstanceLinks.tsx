"use client";
import { useState } from "react";
import { ExternalLink, Link2, Check } from "lucide-react";
import { useBrevId, setBrevId, brevUrl, BREV_SERVICES, needsId, type BrevService } from "@/lib/brev";

const ORDER: BrevService[] = ["openclaw", "grafana", "openshift"];

export function InstanceLinks() {
  const id = useBrevId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-2.5 py-1 transition hover:border-[var(--color-nv-dim)] hover:text-[var(--color-nv-bright)]"
        title="Open your instance's services">
        <Link2 size={13} /> <span className="hidden sm:inline">Links</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-3 text-[var(--color-fg-dim)] shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-mut)]">Open a service</div>
            <ul className="space-y-1">
              {ORDER.map((svc) => {
                const url = brevUrl(svc, id);
                const blocked = needsId(svc) && !id;
                return (
                  <li key={svc}>
                    <a href={url ?? "#"} target="_blank" rel="noreferrer"
                      onClick={(e) => { if (blocked) { e.preventDefault(); setOpen(false); } }}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] ${blocked ? "cursor-default text-[var(--color-fg-mut)]" : "text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"}`}>
                      <span>{BREV_SERVICES[svc].label}</span>
                      {blocked ? <span className="text-[10px]">needs ID</span> : <ExternalLink size={13} className="text-[var(--color-fg-mut)]" />}
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 border-t border-[var(--color-line)] pt-2">
              <label className="text-[11px] text-[var(--color-fg-mut)]">Your Brev instance ID</label>
              <div className="mt-1 flex gap-1.5">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={id || "1ut2jitd"}
                  className="min-w-0 flex-1 rounded border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-2 py-1 font-mono text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-nv-dim)]" />
                <button onClick={() => { if (draft.trim()) { setBrevId(draft); setDraft(""); } }}
                  className="inline-flex items-center rounded border border-[var(--color-nv-dim)] px-2 text-[11px] font-semibold text-[var(--color-nv-bright)] hover:bg-[var(--color-bg-2)]">
                  {id ? <Check size={13} /> : "Save"}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--color-fg-mut)]">
                Usually auto-detected from this page&apos;s URL. The ID is the suffix in your instance&apos;s Shareable URLs (e.g. <code>openshift-<b>1ut2jitd</b>.stg.apps.launchpad.nvidia.com</code>) — override it here if a link doesn&apos;t resolve.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
