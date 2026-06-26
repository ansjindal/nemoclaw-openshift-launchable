// Single source of truth for the workshop's parts/lessons nav.
// Each lesson maps to src/content/<slug>.mdx. hasLab → renders the live terminal.
export type Lesson = { slug: string; title: string; blurb: string; minutes: number; hasLab?: boolean };
export type Part = { id: string; title: string; subtitle: string; accent?: "rh" | "nv"; lessons: Lesson[] };

export const CURRICULUM: Part[] = [
  {
    id: "welcome",
    title: "Part I · Welcome",
    subtitle: "The event, what you build, what you need",
    lessons: [
      { slug: "welcome", title: "Welcome — Red Hat × NVIDIA", blurb: "WeAreDevelopers 2026: an AI agent on OpenShift, powered by NVIDIA.", minutes: 5 },
      { slug: "what-youll-build", title: "What You’ll Build: Meet Shifty", blurb: "A sandboxed AI agent (“Shifty 🦞”) inside your own OpenShift cluster.", minutes: 6 },
      { slug: "prerequisites", title: "Prerequisites & Brev Credits", blurb: "A laptop, a browser, and the free Brev credits we hand out. No GPU.", minutes: 4 },
    ],
  },
  {
    id: "architecture",
    title: "Part II · Architecture",
    subtitle: "How the whole stack fits together",
    accent: "rh",
    lessons: [
      { slug: "big-picture", title: "The Big Picture", blurb: "Brev → podman → MicroShift/OpenShift → OpenShell → OpenClaw.", minutes: 8 },
      { slug: "why-openshift", title: "Why OpenShift (and MicroShift)", blurb: "Red Hat’s enterprise Kubernetes, container-sized.", minutes: 7 },
      { slug: "openshell", title: "OpenShell: The Agent Runtime", blurb: "NVIDIA’s sandbox control plane for agents.", minutes: 8 },
      { slug: "openclaw", title: "OpenClaw: Agent, Gateway & Pairing", blurb: "The agent, its control UI, and how device pairing works.", minutes: 8 },
    ],
  },
  {
    id: "deploy",
    title: "Part III · Deploy the Stack",
    subtitle: "Hands-on: stand up your cluster + agent",
    accent: "nv",
    lessons: [
      { slug: "deploy", title: "One-Command Setup", blurb: "Run setup.sh and watch the stack come up — in the live shell.", minutes: 12, hasLab: true },
      { slug: "access", title: "Open the Agent & Console", blurb: "Reach the OpenClaw UI and the OpenShift console.", minutes: 8, hasLab: true },
    ],
  },
  {
    id: "operate",
    title: "Part IV · Operate the Agent",
    subtitle: "Run real commands against your agent",
    accent: "nv",
    lessons: [
      { slug: "pairing", title: "Device Pairing: list & approve", blurb: "Approve your browser the real way: openclaw devices list / approve.", minutes: 10, hasLab: true },
      { slug: "models", title: "Add a Model & Reload", blurb: "Point Shifty at an inference endpoint and reload its config.", minutes: 10, hasLab: true },
      { slug: "openshell-ops", title: "OpenShell & Cluster Ops", blurb: "Inspect sandboxes, pods, logs, and policy from the shell.", minutes: 10, hasLab: true },
    ],
  },
  {
    id: "build",
    title: "Part V · Build On Top",
    subtitle: "The hackathon: Cluster Copilot",
    accent: "rh",
    lessons: [
      { slug: "usecase", title: "The Cluster Copilot Challenge", blurb: "Turn Shifty into an OpenShift-native DevOps copilot.", minutes: 10 },
      { slug: "extend", title: "Extending Shifty", blurb: "Give the agent cluster powers: skills, tools, policies.", minutes: 12, hasLab: true },
      { slug: "ideas", title: "Ideas & Scoring", blurb: "Starter ideas, stretch goals, and how submissions are judged.", minutes: 6 },
    ],
  },
  {
    id: "reference",
    title: "Part VI · Reference",
    subtitle: "When something goes sideways",
    lessons: [
      { slug: "troubleshooting", title: "Troubleshooting & FAQ", blurb: "The gotchas we hit so you don’t have to.", minutes: 8, hasLab: true },
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
