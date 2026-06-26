"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CURRICULUM, ALL_LESSONS } from "@/lib/curriculum";
import { FlaskConical } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const numberOf = (slug: string) => ALL_LESSONS.findIndex((l) => l.slug === slug) + 1;
  return (
    <nav className="space-y-6 text-sm" aria-label="Lessons">
      {CURRICULUM.map((part) => (
        <div key={part.id}>
          <div className="px-2 pb-2">
            <div className={`text-[0.82rem] font-bold ${part.accent === "rh" ? "text-[var(--color-rh-bright)]" : part.accent === "nv" ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg)]"}`}>{part.title}</div>
            <div className="text-[0.7rem] text-[var(--color-fg-mut)]">{part.subtitle}</div>
          </div>
          {part.lessons.map((l) => {
            const active = pathname === `/learn/${l.slug}`;
            return (
              <Link key={l.slug} href={`/learn/${l.slug}`}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${active ? "bg-[var(--color-panel-2)] text-[var(--color-fg)]" : "text-[var(--color-fg-dim)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"}`}
                style={active ? { borderLeft: "2px solid var(--color-nv)" } : { borderLeft: "2px solid transparent" }}>
                <span className="w-4 text-[0.7rem] text-[var(--color-fg-mut)]">{numberOf(l.slug)}</span>
                <span className="flex-1">{l.title}</span>
                {l.hasLab && <FlaskConical size={12} className="text-[var(--color-nv)]" />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
