import { Approvals } from "@/components/Approvals";

export const metadata = { title: "Device Approvals · OpenShell on OpenShift" };
export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-mut)]">Operator · human-in-the-loop control</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-fg)]">Approvals</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-fg-mut)]">
        Two inboxes, both gated by you. <strong>Access requests</strong>: when the agent is denied reaching an API or website, the gateway proposes an allow-rule — approve to merge it into the live egress policy, deny to reject. <strong>Device approvals</strong>: when a browser or CLI asks to pair with the agent&apos;s Control UI, approve or deny it here.
      </p>
      <Approvals />
    </main>
  );
}
