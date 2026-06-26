// Tiny client-side bus that lets an MDX command block inject a command into the
// live lab terminal. The Terminal registers a sender when its WebSocket opens;
// command blocks call runInShell(). Commands issued before the shell is live are
// queued and flushed on connect (and the shell is auto-launched).
type Sender = (text: string) => void;

let sender: Sender | null = null;
const queue: string[] = [];

export function registerShellSender(s: Sender | null) {
  sender = s;
  if (s) while (queue.length) s(queue.shift()!);
}

export function runInShell(text: string) {
  const cmd = text.replace(/\s+$/, "");
  if (!cmd) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("oclaw:start-shell"));
  }
  if (sender) sender(cmd);
  else queue.push(cmd);
}

export function runApiCheck(cmd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return fetch("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cmd }),
  })
    .then((r) => r.json())
    .catch((e) => ({ exitCode: 1, stdout: "", stderr: String(e) }));
}
