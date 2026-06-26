"use client";
import { useState, type ReactNode, isValidElement } from "react";
import { runInShell } from "@/lib/labBus";

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children);
  return "";
}

// Override for MDX <pre>: every fenced block gets a Copy / Run-in-shell toolbar.
export function CodeBlock({ children }: { children?: ReactNode }) {
  const code = extractText(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);
  // Heuristic: shell-ish blocks (commands) get a Run button.
  const runnable = /(^|\n)\s*(oc |openclaw |kubectl |helm |sudo |curl |\.\/scripts|git |cat |export )/.test(code) ||
    code.split("\n").length <= 6;

  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-code-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-1.5">
        <span className="font-mono text-[11px] text-[var(--color-fg-mut)]">shell</span>
        <div className="flex gap-2">
          {runnable && (
            <button
              onClick={() => runInShell(code)}
              className="rounded border border-[var(--color-nv-dim)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-nv-bright)] hover:bg-[var(--color-panel)]"
              title="Run this in the lab shell"
            >
              ▶ Run in shell
            </button>
          )}
          <button
            onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
            className="rounded border border-[var(--color-line-2)] px-2 py-0.5 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[var(--color-code-fg)]">{children}</pre>
    </div>
  );
}
