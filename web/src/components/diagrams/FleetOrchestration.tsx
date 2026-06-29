import { DIAGRAM as C } from "./palette";

// Part VI capstone: an orchestrator app uses the completions API to decompose a task,
// fans sub-tasks out to a fleet of SPECIALIST agents (each carrying one registry skill +
// its own scoped egress policy), then synthesizes their results. Every agent is sealed and
// audited; the model is reached through one governed endpoint.
export function FleetOrchestration() {
  const W = 920, H = 460;
  const Node = ({ x, y, w, h = 58, fill, stroke, title, sub, dash }: { x: number; y: number; w: number; h?: number; fill: string; stroke: string; title: string; sub: string; dash?: boolean }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={11} fill={fill} stroke={stroke} strokeWidth={1.6} strokeDasharray={dash ? "5 4" : undefined} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 1 : h / 2 + 4)} fontSize={12.5} fill={C.ink} textAnchor="middle" fontWeight={700}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 14} fontSize={9.8} fill={C.sub} textAnchor="middle">{sub}</text>}
    </g>
  );
  const Arrow = ({ x1, y1, x2, y2, label, color = C.ctrl, dash, lx, ly }: { x1: number; y1: number; x2: number; y2: number; label?: string; color?: string; dash?: boolean; lx?: number; ly?: number }) => (
    <g>
      <path d={`M${x1},${y1} L${x2},${y2}`} stroke={color} strokeWidth={1.9} fill="none" markerEnd="url(#fo_ar)" strokeDasharray={dash ? "5 4" : undefined} />
      {label && <text x={lx ?? (x1 + x2) / 2} y={ly ?? Math.min(y1, y2) - 6} fontSize={9.6} fill={color} textAnchor="middle" fontWeight={600}>{label}</text>}
    </g>
  );
  const agents = [
    { y: 70, role: "reader 🦞", skill: "@workshop/repo-reader", egress: "github.com only" },
    { y: 196, role: "searcher 🦞", skill: "web-search", egress: "duckduckgo.com only" },
    { y: 322, role: "writer 🦞", skill: "summarizer", egress: "no egress" },
  ];
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-[var(--color-line)]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" fontFamily={C.font} role="img" aria-label="Specialist fleet orchestration">
        <defs><marker id="fo_ar" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={C.ctrl} /></marker></defs>
        <rect x={0} y={0} width={W} height={H} fill={C.bg} />

        <text x={95} y={26} fontSize={11} fill={C.sub} textAnchor="middle" fontWeight={700}>① ASK</text>
        <text x={340} y={26} fontSize={11} fill={C.sub} textAnchor="middle" fontWeight={700}>② ORCHESTRATE</text>
        <text x={700} y={26} fontSize={11} fill={C.sub} textAnchor="middle" fontWeight={700}>③ SPECIALIST FLEET</text>

        {/* request */}
        <Node x={25} y={196} w={140} fill={C.gray} stroke={C.ctrl} title="You / an app 🧑‍💻" sub="one real task" />

        {/* orchestrator + model */}
        <Node x={250} y={150} w={180} h={150} fill={C.lav} stroke={C.auth} title="Orchestrator" sub="" />
        <text x={340} y={205} fontSize={9.8} fill={C.sub} textAnchor="middle">plan → route → synthesize</text>
        <text x={340} y={222} fontSize={9.8} fill={C.sub} textAnchor="middle">(~100 lines)</text>
        <Node x={250} y={350} w={180} h={46} fill={C.blue} stroke="#6f8fd0" title="Completions API" sub="decompose + merge · inference.local" />
        <Arrow x1={340} y1={300} x2={340} y2={350} />
        <Arrow x1={340} y1={350} x2={340} y2={302} />

        <Arrow x1={165} y1={222} x2={250} y2={222} label="task" color={C.use} />

        {/* specialist fleet */}
        {agents.map((a, i) => (
          <g key={i}>
            <Node x={600} y={a.y} w={290} fill={C.greenTint} stroke={C.nvidia} title={a.role} sub={`${a.skill} · ${a.egress}`} />
            <Arrow x1={430} y1={a.y === 196 ? 210 : 225} x2={600} y2={a.y + 29} label={i === 0 ? "sub-task" : undefined} color={C.green} lx={515} ly={a.y + 14} />
            <Arrow x1={600} y1={a.y + 38} x2={430} y2={a.y === 196 ? 240 : 235} color={C.ctrl} />
          </g>
        ))}
        <text x={745} y={398} fontSize={9.6} fill={C.sub} textAnchor="middle">each: gVisor-sealed · one registry skill · its own egress rule</text>

        <text x={W / 2} y={432} fontSize={10.5} fill={C.sub} textAnchor="middle">Spin the fleet with one helper (<tspan fontStyle="italic">fleet up</tspan>); the orchestrator routes each step to the agent whose skill + policy fit.</text>
        <text x={W / 2} y={449} fontSize={10.5} fill={C.sub} textAnchor="middle">Every sub-task and every egress call is governed by per-agent policy and lands in the audit log.</text>
      </svg>
    </figure>
  );
}
