import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-[rgba(10,12,16,0.82)] px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
        <span>🦞</span>
        <span className="hidden sm:inline">
          <span className="text-[var(--color-fg-dim)]">OpenClaw</span>
          <span className="text-[var(--color-fg-mut)]"> · </span>
          <span className="text-[var(--color-nv-bright)]">OpenShell</span>
          <span className="text-[var(--color-fg-mut)]"> on </span>
          <span className="text-[var(--color-rh-bright)]">OpenShift</span>
        </span>
        <span className="sm:hidden">OpenClaw on OpenShift</span>
      </Link>
      <div className="ml-auto flex items-center gap-2 text-[0.72rem] text-[var(--color-fg-mut)]">
        <span className="rounded-full border border-[rgba(238,0,0,0.35)] px-2.5 py-1 text-[var(--color-rh-bright)]">Red Hat</span>
        <span className="rounded-full border border-[rgba(118,185,0,0.35)] px-2.5 py-1 text-[var(--color-nv-bright)]">NVIDIA</span>
        <span className="hidden rounded-full border border-[var(--color-line-2)] px-2.5 py-1 md:inline">WeAreDevelopers 2026</span>
      </div>
    </header>
  );
}
