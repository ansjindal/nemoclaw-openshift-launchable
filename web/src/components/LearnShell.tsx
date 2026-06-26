"use client";
import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./Sidebar";

// Full-width learn shell with a collapsible lesson sidebar.
export function LearnShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex w-full">
      {open && (
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--color-line)] lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
            <Sidebar />
          </div>
        </aside>
      )}
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        <button
          onClick={() => setOpen((v) => !v)}
          className="mb-4 hidden items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-xs text-[var(--color-fg-mut)] hover:text-white lg:inline-flex"
          title={open ? "Collapse lessons" : "Show lessons"}
        >
          {open ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          {open ? "Hide lessons" : "Lessons"}
        </button>
        {children}
      </main>
    </div>
  );
}
