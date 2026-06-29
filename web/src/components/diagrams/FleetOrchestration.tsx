import { DIAGRAM as C } from "./palette";

// Part VI capstone: an orchestrator app uses the completions API to decompose a task,
// fans sub-tasks out to a fleet of SPECIALIST agents (each carrying one registry skill +
// its own scoped egress policy), then synthesizes their results. Every agent is sealed and
// audited; the model is reached through one governed endpoint.
//
// Theme-aware: structural colors (surface, ink, lines) come from the site CSS variables
// via the in-SVG <style> block, so it reads correctly in BOTH dark and light. Accent
// hues (orchestrator = violet, model = blue, fleet = NVIDIA green) are translucent fills
// over the surface so they work on either background.
export function FleetOrchestration() {
  const W = 940, H = 470;
  const VIOLET = "#a78bfa", BLUE = "#7aa2e3", GREEN = "#8fce46", CYAN = "#34d4e0";

  const Node = ({ x, y, w, h = 58, cls, stroke, title, sub, dash }: { x: number; y: number; w: number; h?: number; cls: string; stroke: string; title: string; sub?: string; dash?: boolean }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className={cls} stroke={stroke} strokeWidth={1.6} strokeDasharray={dash ? "5 4" : undefined} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 1 : h / 2 + 4)} fontSize={13} className="fo-ink" textAnchor="middle" fontWeight={700}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 14} fontSize={9.8} className="fo-sub" textAnchor="middle">{sub}</text>}
    </g>
  );
  const Arrow = ({ x1, y1, x2, y2, label, color, dash, lx, ly, marker }: { x1: number; y1: number; x2: number; y2: number; label?: string; color: string; dash?: boolean; lx?: number; ly?: number; marker: string }) => (
    <g>
      <path d={`M${x1},${y1} L${x2},${y2}`} stroke={color} strokeWidth={1.9} fill="none" markerEnd={`url(#${marker})`} strokeDasharray={dash ? "5 4" : undefined} opacity={dash ? 0.7 : 1} />
      {label && <text x={lx ?? (x1 + x2) / 2} y={ly ?? Math.min(y1, y2) - 6} fontSize={9.6} fill={color} textAnchor="middle" fontWeight={700}>{label}</text>}
    </g>
  );

  const ox = 250, ow = 180, ocx = ox + ow / 2;          // orchestrator box
  const fx = 612, fw = 300;                              // fleet cards
  const agents = [
    { y: 64, role: "logs 🦞", skill: "reads Loki", egress: "loki:3100 only" },
    { y: 196, role: "metrics 🦞", skill: "reads Prometheus", egress: "prometheus:9090 only" },
    { y: 328, role: "traces 🦞", skill: "reads Tempo", egress: "tempo:3200 only" },
  ];

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" fontFamily={C.font} role="img" aria-label="Specialist fleet orchestration">
        <style>{`
          .fo-surface{fill:var(--color-panel);}
          .fo-card{fill:var(--color-bg-2);}
          .fo-ink{fill:var(--color-fg);}
          .fo-sub{fill:var(--color-fg-mut);}
          .fo-phase{fill:var(--color-fg-mut);letter-spacing:.08em;}
          .fo-lane{fill:var(--color-fg);opacity:.025;}
          .fo-violet{fill:${VIOLET};opacity:.14;}
          .fo-blue{fill:${BLUE};opacity:.14;}
          .fo-green{fill:${GREEN};opacity:.13;}
        `}</style>
        <defs>
          <marker id="fo_v" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={CYAN} /></marker>
          <marker id="fo_g" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={GREEN} /></marker>
          <marker id="fo_r" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="fo-sub" /></marker>
        </defs>

        <rect x={0} y={0} width={W} height={H} className="fo-surface" />
        {/* faint phase lanes */}
        <rect x={14} y={40} width={206} height={394} rx={14} className="fo-lane" />
        <rect x={236} y={40} width={232} height={394} rx={14} className="fo-lane" />
        <rect x={596} y={40} width={332} height={394} rx={14} className="fo-lane" />

        <text x={117} y={30} fontSize={11} className="fo-phase" textAnchor="middle" fontWeight={800}>① ASK</text>
        <text x={352} y={30} fontSize={11} className="fo-phase" textAnchor="middle" fontWeight={800}>② ORCHESTRATE</text>
        <text x={762} y={30} fontSize={11} className="fo-phase" textAnchor="middle" fontWeight={800}>③ SPECIALIST FLEET</text>

        {/* ask */}
        <Node x={32} y={196} w={170} cls="fo-card" stroke={C.ctrl} title="You / an app 🧑‍💻" sub="one real task" />
        <Arrow x1={202} y1={225} x2={ox} y2={225} label="task" color={CYAN} marker="fo_v" />

        {/* orchestrator + model */}
        <Node x={ox} y={150} w={ow} h={150} cls="fo-violet" stroke={VIOLET} title="Orchestrator" />
        <text x={ocx} y={206} fontSize={9.8} className="fo-sub" textAnchor="middle">plan → route → synthesize</text>
        <text x={ocx} y={222} fontSize={9.8} className="fo-sub" textAnchor="middle">(~100 lines)</text>
        <Node x={ox} y={352} w={ow} h={48} cls="fo-blue" stroke={BLUE} title="Completions API" sub="decompose + merge · inference.local" />
        <Arrow x1={ocx - 8} y1={300} x2={ocx - 8} y2={352} color={BLUE} marker="fo_g" />
        <path d={`M${ocx + 8},352 L${ocx + 8},302`} stroke={BLUE} strokeWidth={1.9} fill="none" markerEnd="url(#fo_g)" opacity={0.7} strokeDasharray="5 4" />

        {/* specialist fleet — clean parallel fan-out + dashed responses */}
        {agents.map((a, i) => {
          const cy = a.y + 29;
          return (
            <g key={i}>
              <Node x={fx} y={a.y} w={fw} cls="fo-green" stroke={C.nvidia} title={a.role} sub={`${a.skill} · ${a.egress}`} />
              <Arrow x1={ox + ow} y1={222} x2={fx} y2={cy - 6} label={i === 0 ? "sub-task" : undefined} color={GREEN} marker="fo_g" lx={fx - 70} ly={a.y + 10} />
              <Arrow x1={fx} y1={cy + 8} x2={ox + ow} y2={232} color={C.sub} marker="fo_r" dash />
            </g>
          );
        })}
        <text x={fx + fw / 2} y={a_footer_y(agents)} fontSize={9.6} className="fo-sub" textAnchor="middle">each: sealed · its own IDENTITY/SOUL · egress to ONE telemetry backend</text>

        <text x={W / 2} y={444} fontSize={10.5} className="fo-sub" textAnchor="middle" fontWeight={600}>An SRE copilot fleet: give it an incident, it fans across logs + metrics + traces and synthesizes a root cause.</text>
        <text x={W / 2} y={460} fontSize={10.5} className="fo-sub" textAnchor="middle">Each agent provably reaches only its backend — and the fix is applied with a human in the loop.</text>
      </svg>
    </figure>
  );
}

function a_footer_y(agents: { y: number }[]) {
  return agents[agents.length - 1].y + 58 + 14;
}
