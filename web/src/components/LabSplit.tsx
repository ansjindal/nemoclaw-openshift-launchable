"use client";
import { useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Terminal } from "./Terminal";

// Hands-on lessons: content on the left, a live lab shell on the right.
// The shell column is draggable (resize width) and sticky (stays in view on scroll).
// On small screens it stacks below the content.
export function LabSplit({ children }: { children: ReactNode; slug?: string }) {
  const [shellPct, setShellPct] = useState(44); // % width of the shell column (desktop)
  const [show, setShow] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = ((r.right - ev.clientX) / r.width) * 100;
      setShellPct(Math.min(68, Math.max(26, pct)));
    };
    const up = () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  if (!show) {
    return (
      <div className="prose max-w-3xl">
        {children}
        <button onClick={() => setShow(true)} className="fixed bottom-4 right-4 z-30 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold text-[var(--color-nv-bright)]">
          ▶ show shell
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex w-full flex-col lg:flex-row" style={{ "--shell-w": `${shellPct}%` } as CSSProperties}>
      <div className="prose min-w-0 flex-1 lg:pr-3">{children}</div>

      <div
        onMouseDown={startDrag}
        className="hidden w-1.5 shrink-0 cursor-col-resize bg-[var(--color-line)] transition-colors hover:bg-[var(--color-nv)] lg:block"
        title="Drag to resize the shell"
      />

      <div className="mt-4 w-full shrink-0 lg:mt-0 lg:w-auto lg:basis-[var(--shell-w)]">
        <div className="lg:sticky lg:top-16">
          <Terminal title="lab shell — oc + openclaw" fill />
          <button onClick={() => setShow(false)} className="mt-2 text-xs text-[var(--color-fg-mut)] hover:text-white">hide shell</button>
        </div>
      </div>
    </div>
  );
}
