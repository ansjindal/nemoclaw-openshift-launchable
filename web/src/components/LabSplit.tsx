"use client";
import { useState, type ReactNode } from "react";
import { Terminal } from "./Terminal";

// Hands-on lessons: content on the left, a live lab shell on the right (stacks on mobile).
export function LabSplit({ children }: { children: ReactNode; slug?: string }) {
  const [showShell, setShowShell] = useState(true);
  return (
    <div className={`grid gap-6 ${showShell ? "lg:grid-cols-[1fr_minmax(420px,46%)]" : ""}`}>
      <div className="prose max-w-none min-w-0">{children}</div>
      {showShell && (
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Terminal title="lab shell — oc + openclaw" fill />
          <button onClick={() => setShowShell(false)} className="mt-2 text-xs text-[var(--color-fg-mut)] hover:text-white">hide shell</button>
        </div>
      )}
      {!showShell && (
        <button onClick={() => setShowShell(true)} className="fixed bottom-4 right-4 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold text-[var(--color-nv-bright)]">▶ shell</button>
      )}
    </div>
  );
}
