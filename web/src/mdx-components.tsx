import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/Terminal";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";
import { StackDiagram } from "@/components/diagrams/StackDiagram";
import { CopilotFlow } from "@/components/diagrams/CopilotFlow";

const components: MDXComponents = {
  Terminal,
  Callout,
  StackDiagram,
  CopilotFlow,
  pre: CodeBlock, // every fenced code block gets a Copy / Run-in-shell toolbar
};

export function useMDXComponents(): MDXComponents {
  return components;
}

export { components as mdxComponents };
