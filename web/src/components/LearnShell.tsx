"use client";
import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./Sidebar";

// Full-width learn shell with a collapsible lesson sidebar.
// The collapse control lives at the TOP of the sidebar; when collapsed, a small
// "Lessons" button in the content reopens it.
export function LearnShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex w-full">
      {open && (
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--color-line)] lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
            <button
              onClick={() => setOpen(false)}
              className="mb-3 flex w-full items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-xs text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"
              title="Hide lessons"
            >
              <PanelLeftClose size={14} /> Hide lessons
            </button>
            <Sidebar />
          </div>
        </aside>
      )}
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="mb-4 hidden items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-xs text-[var(--color-fg-mut)] hover:text-[var(--color-fg)] lg:inline-flex"
            title="Show lessons"
          >
            <PanelLeftOpen size={14} /> Lessons
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
