import "./globals.css";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "OpenClaw on OpenShift — Red Hat × NVIDIA Workshop",
  description: "WeAreDevelopers 2026 — deploy an AI agent (Shifty 🦞) on single-node OpenShift via NVIDIA OpenShell, with a live shell. Build a Cluster Copilot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
