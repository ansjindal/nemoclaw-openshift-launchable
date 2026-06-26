"use client";
import { useState, type ReactNode } from "react";

export type ArchNode = { id: string; label: string; sub?: string; color: string; detail: ReactNode };

// Interactive architecture diagram: click a component to reveal what it does.
// `flow` renders arrows between nodes (left→right pipeline).
export function ArchExplorer({ title, nodes, flow = false }: { title?: string; nodes: ArchNode[]; flow?: boolean }) {
  const [sel, setSel] = useState(nodes[0]?.id);
  const active = nodes.find((n) => n.id === sel) ?? nodes[0];
  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      {title && <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">{title}</figcaption>}
      <div className="flex flex-wrap items-stretch gap-2">
        {nodes.map((n, i) => (
          <div key={n.id} className="flex items-stretch gap-2">
            <button
              onClick={() => setSel(n.id)}
              className="rounded-lg border px-3 py-2 text-left transition"
              style={{ borderColor: n.color, background: sel === n.id ? `${n.color}22` : "transparent", opacity: sel === n.id ? 1 : 0.7 }}
            >
              <div className="text-sm font-semibold" style={{ color: n.color }}>{n.label}</div>
              {n.sub && <div className="text-[11px] text-[var(--color-fg-mut)]">{n.sub}</div>}
            </button>
            {flow && i < nodes.length - 1 && <span className="self-center text-[var(--color-fg-mut)]">→</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-fg-dim)]">
        <div className="mb-1 text-xs font-semibold" style={{ color: active.color }}>{active.label}</div>
        {active.detail}
      </div>
    </figure>
  );
}
