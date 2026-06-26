import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/Terminal";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";
import { StackDiagram } from "@/components/diagrams/StackDiagram";
import { CopilotFlow } from "@/components/diagrams/CopilotFlow";
import { OpenClawArch } from "@/components/diagrams/OpenClawArch";
import { OpenShellArch } from "@/components/diagrams/OpenShellArch";
import { OpenShellRuntime } from "@/components/diagrams/OpenShellRuntime";
import { DeployTopology } from "@/components/diagrams/DeployTopology";
import { OpenShellOnK8s } from "@/components/diagrams/OpenShellOnK8s";
import { OpenShellConsole } from "@/components/diagrams/OpenShellConsole";
import { SandboxFlow } from "@/components/diagrams/SandboxFlow";
import { SecurityLayers } from "@/components/diagrams/SecurityLayers";

const components: MDXComponents = {
  Terminal,
  Callout,
  StackDiagram,
  CopilotFlow,
  OpenClawArch,
  OpenShellArch,
  OpenShellRuntime,
  DeployTopology,
  OpenShellOnK8s,
  OpenShellConsole,
  SandboxFlow,
  SecurityLayers,
  pre: CodeBlock, // every fenced code block gets a Copy / Run-in-shell toolbar
};

export function useMDXComponents(): MDXComponents {
  return components;
}

export { components as mdxComponents };
