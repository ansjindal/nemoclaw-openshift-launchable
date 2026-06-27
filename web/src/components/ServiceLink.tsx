"use client";
import { type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { useBrevId, brevUrl, setBrevId, needsId, BREV_SERVICES, type BrevService } from "@/lib/brev";

// Inline "open X" link for lessons: <ServiceLink service="openclaw">Open the OpenClaw UI</ServiceLink>.
// Path-based services (grafana) just link same-origin. Subdomain services prompt once for
// the Brev instance ID, then open — and remember it (also settable from the header Links menu).
export function ServiceLink({ service, children }: { service: BrevService; children?: ReactNode }) {
  const id = useBrevId();
  const href = brevUrl(service, id);
  const label = children ?? `Open ${BREV_SERVICES[service].label}`;

  const onClick = (e: React.MouseEvent) => {
    if (needsId(service) && !id) {
      e.preventDefault();
      const raw = window.prompt(
        "Your Brev instance ID (e.g. agcuo13nx) — it's the suffix in any of your instance's Shareable URLs, like openshift-agcuo13nx.brevlab.com. You can also paste the whole URL.",
      );
      if (!raw) return;
      setBrevId(raw);
      const url = brevUrl(service, raw.match(/-([a-z0-9]+)\.brevlab\.com/i)?.[1] ?? raw.trim());
      if (url) window.open(url, "_blank", "noreferrer");
    }
  };

  return (
    <a href={href ?? "#"} target="_blank" rel="noreferrer" onClick={onClick}
      className="inline-flex items-center gap-1 font-medium text-[var(--color-nv-bright)] underline decoration-[var(--color-nv-dim)] underline-offset-2 hover:decoration-[var(--color-nv-bright)]">
      {label} <ExternalLink size={13} />
    </a>
  );
}
