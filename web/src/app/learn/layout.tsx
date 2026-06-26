import { Sidebar } from "@/components/Sidebar";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-[var(--color-line)] lg:block">
        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
          <Sidebar />
        </div>
      </aside>
      <main className="min-w-0 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
