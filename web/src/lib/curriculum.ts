// Single source of truth for the workshop's parts/lessons nav.
// Each lesson maps to src/content/<slug>.mdx. hasLab → renders the live terminal.
export type Lesson = { slug: string; title: string; blurb: string; minutes: number; hasLab?: boolean };
export type Part = { id: string; title: string; subtitle: string; accent?: "rh" | "nv"; lessons: Lesson[] };

export const CURRICULUM: Part[] = [
  {
    id: "welcome",
    title: "Part I · Welcome",
    subtitle: "The event, the platform, what you need",
    lessons: [
      { slug: "welcome", title: "Welcome — Red Hat × NVIDIA", blurb: "WeAreDevelopers 2026: build a sandboxed AI agent on OpenShift, powered by NVIDIA.", minutes: 5 },
      { slug: "prerequisites", title: "Prerequisites & Brev Credits", blurb: "A laptop, a browser, and the free Brev credits we hand out. No GPU.", minutes: 4 },
    ],
  },
  {
    id: "platform",
    title: "Part II · What's Already Running",
    subtitle: "The platform we pre-built for you — how it was made, and how to read it",
    accent: "rh",
    lessons: [
      { slug: "big-picture", title: "The Big Picture", blurb: "Brev → podman → MicroShift/OpenShift → OpenShell gateway → Envoy → your agent.", minutes: 8 },
      { slug: "why-openshift", title: "Why OpenShift (and MicroShift)", blurb: "Red Hat's enterprise Kubernetes, container-sized — and why it's the base.", minutes: 7 },
      { slug: "the-cluster", title: "Your Cluster, Already Up", blurb: "How MicroShift-in-podman was stood up — and inspect it live with oc.", minutes: 8, hasLab: true },
      { slug: "openshell", title: "The OpenShell Gateway", blurb: "The agent control plane: agent-sandbox CRD + the Helm chart + the compute driver — and drive it with the CLI.", minutes: 9, hasLab: true },
    ],
  },
  {
    id: "understand-openshell",
    title: "Part III · How OpenShell Works",
    subtitle: "Understand and drive the control plane — before you build an agent on it",
    accent: "nv",
    lessons: [
      { slug: "openshell-ops", title: "Control Plane & Policies", blurb: "The gateway, the sandbox CRD, and the deny-by-default policy model that governs every agent.", minutes: 10, hasLab: true },
      { slug: "explore", title: "Explore It Hands-On", blurb: "Spin a throwaway sandbox and play with every part: status, logs/audit, policy get & prove, inference, forward.", minutes: 12, hasLab: true },
    ],
  },
  {
    id: "build-agent",
    title: "Part IV · Build Your Agent",
    subtitle: "Hands-on: create an OpenClaw agent on the gateway, step by step",
    accent: "nv",
    lessons: [
      { slug: "inference", title: "Set Your Inference Endpoint", blurb: "Put your endpoint, model & key in .env, and verify them with a /v1/models call.", minutes: 6, hasLab: true },
      { slug: "create-agent", title: "Create Your Agent", blurb: "openshell sandbox create + an egress policy → your own sealed OpenClaw sandbox.", minutes: 10, hasLab: true },
      { slug: "configure", title: "Give It a Brain", blurb: "Stage openclaw.json (model + gateway auth) and start the OpenClaw gateway inside the sandbox.", minutes: 9, hasLab: true },
      { slug: "access", title: "Open the Agent UI", blurb: "Expose it with openshell forward and open the Control UI at your Brev URL.", minutes: 6, hasLab: true },
      { slug: "pairing", title: "Pair Your Browser", blurb: "First open asks for device pairing — approve it: openclaw devices list / approve.", minutes: 7, hasLab: true },
      { slug: "chat", title: "Talk to Your Agent", blurb: "Your first conversation — and watch the policy + sandbox in action.", minutes: 7, hasLab: true },
    ],
  },
  {
    id: "operate",
    title: "Part V · Make It Yours & Operate",
    subtitle: "Give it identity, then run it as a real agent",
    accent: "nv",
    lessons: [
      { slug: "soul", title: "Identity & Soul", blurb: "The workspace .md files that ARE the agent's memory and personality.", minutes: 8, hasLab: true },
      { slug: "into-the-sandbox", title: "Into a Sandbox", blurb: "A sandbox IS a pod — but sealed. exec in two ways and see the isolation.", minutes: 8, hasLab: true },
    ],
  },
  {
    id: "build",
    title: "Part VI · Build Something Useful",
    subtitle: "The hackathon: a multi-agent app (we design this together)",
    accent: "rh",
    lessons: [
      { slug: "what-youll-build", title: "The Challenge: A Multi-Agent App", blurb: "What governed external work + multiple sandboxes can do — and how it's judged.", minutes: 8 },
    ],
  },
  {
    id: "reference",
    title: "Part VII · Reference",
    subtitle: "A live fleet view, optional add-ons, and when something goes sideways",
    lessons: [
      { slug: "live", title: "Live OpenShell", blurb: "Your gateway + sandboxes, read live from the cluster and rendered in this page.", minutes: 4 },
      { slug: "monitoring", title: "Observability (optional)", blurb: "Add Prometheus + Grafana + Loki + Tempo to watch the fleet.", minutes: 8, hasLab: true },
      { slug: "troubleshooting", title: "Troubleshooting & FAQ", blurb: "The gotchas we hit so you don't have to.", minutes: 8, hasLab: true },
      { slug: "resources", title: "Resources & Links", blurb: "Docs, repos, and where to go deeper.", minutes: 4 },
    ],
  },
];

export const ALL_LESSONS: (Lesson & { partId: string; partTitle: string })[] =
  CURRICULUM.flatMap((p) => p.lessons.map((l) => ({ ...l, partId: p.id, partTitle: p.title })));

export function lessonNeighbors(slug: string) {
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  return {
    prev: i > 0 ? ALL_LESSONS[i - 1] : null,
    next: i >= 0 && i < ALL_LESSONS.length - 1 ? ALL_LESSONS[i + 1] : null,
    current: i >= 0 ? ALL_LESSONS[i] : null,
  };
}

export const FIRST_SLUG = ALL_LESSONS[0]?.slug ?? "welcome";
