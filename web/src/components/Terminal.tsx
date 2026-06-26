"use client";
import { useEffect, useRef, useState } from "react";
import { registerShellSender } from "@/lib/labBus";

type Status = "idle" | "connecting" | "live" | "closed" | "error";

// xterm palette that follows the site's light/dark theme.
function xtermTheme() {
  const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light
    ? { background: "#f3f5f9", foreground: "#1f2937", cursor: "#4d7a00", green: "#4d7a00", brightGreen: "#76b900", selectionBackground: "#cde2a3" }
    : { background: "#0a0c10", foreground: "#d6e0ec", cursor: "#a3e635", green: "#76b900", brightGreen: "#a3e635", selectionBackground: "#243018" };
}

export function Terminal({ title = "lab shell", fill = false }: { title?: string; fill?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const h = fill ? "h-[calc(100vh-9rem)] min-h-[440px]" : "h-[400px]";

  // A command block (runInShell) can ask the shell to launch via this event.
  useEffect(() => {
    const onStart = () => setStarted(true);
    window.addEventListener("oclaw:start-shell", onStart);
    return () => window.removeEventListener("oclaw:start-shell", onStart);
  }, []);

  useEffect(() => {
    if (!started || !hostRef.current) return;
    let term: import("@xterm/xterm").Terminal | undefined;
    let fit: import("@xterm/addon-fit").FitAddon | undefined;
    let ws: WebSocket | undefined;
    let ro: ResizeObserver | undefined;
    let onTheme: (() => void) | undefined;
    let disposed = false;
    setStatus("connecting");

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws/term`;
    const watchdog = setTimeout(() => {
      if (!disposed && ws && ws.readyState !== WebSocket.OPEN) {
        setStatus("error");
        setErr(`Couldn't open ${url} after 8s — likely a proxy not forwarding WebSocket upgrades, or a stale page (hard-refresh).`);
        try { ws.close(); } catch {}
      }
    }, 8000);

    (async () => {
      try {
        const { Terminal: XTerm } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        await import("@xterm/xterm/css/xterm.css");
        if (disposed) return;

        term = new XTerm({
          fontFamily: "var(--font-mono), monospace",
          fontSize: 13,
          cursorBlink: true,
          scrollback: 5000,
          theme: xtermTheme(),
        });
        fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current!);
        fit.fit();
        // follow light/dark toggles live
        onTheme = () => { try { if (term) term.options.theme = xtermTheme(); } catch {} };
        window.addEventListener("oclaw:theme", onTheme);
        term.write("\x1b[90mconnecting to " + url + " …\x1b[0m\r\n");

        ws = new WebSocket(url);
        ws.onopen = () => {
          clearTimeout(watchdog);
          setStatus("live");
          registerShellSender((text) => {
            if (ws!.readyState === 1) ws!.send(text.replace(/\n/g, "\r") + "\r");
          });
          const sendResize = () => { try { ws!.send(`\x00resize:${term!.cols}:${term!.rows}`); } catch {} };
          sendResize();
          ro = new ResizeObserver(() => { try { fit!.fit(); sendResize(); } catch {} });
          ro.observe(hostRef.current!);
        };
        ws.onmessage = (e) => term && term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
        ws.onclose = () => { if (!disposed) setStatus("closed"); registerShellSender(null); };
        ws.onerror = () => { if (!disposed) setStatus("error"); };
        term.onData((d) => { if (ws && ws.readyState === 1) ws.send(d); });
      } catch (e) {
        if (!disposed) { setStatus("error"); setErr(String(e)); }
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(watchdog);
      registerShellSender(null);
      if (onTheme) window.removeEventListener("oclaw:theme", onTheme);
      try { ro?.disconnect(); } catch {}
      try { ws?.close(); } catch {}
      try { term?.dispose(); } catch {}
    };
  }, [started]);

  const dot = status === "live" ? "#76b900" : status === "error" || status === "closed" ? "#ee0000" : "#8a93a3";

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-term-bg)] ${h}`}>
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-fg-mut)]">
        <span style={{ width: 9, height: 9, borderRadius: 9, background: dot, display: "inline-block" }} />
        <span className="font-mono">{title}</span>
        <span className="ml-auto">{status}</span>
      </div>
      {!started ? (
        <button onClick={() => setStarted(true)} className="m-auto rounded-lg border border-[var(--color-nv-dim)] px-5 py-2.5 text-sm font-semibold text-[var(--color-nv-bright)] hover:bg-[var(--color-panel)]">
          ▶ Open lab shell
        </button>
      ) : (
        <div className="min-h-0 flex-1">
          <div ref={hostRef} className="h-full w-full" />
          {err && <div className="px-3 py-2 text-xs text-red-400">{err}</div>}
        </div>
      )}
    </div>
  );
}
