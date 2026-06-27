"use client";
import { useEffect, useState } from "react";

// Reaching the instance's services from the lessons. Two strategies:
//  • PATH-based (best): same-origin path on the workshop site, proxied by Next (see
//    next.config.ts). No instance ID needed. Used for apps that serve under a sub-path
//    (Grafana via serve_from_sub_path).
//  • SUBDOMAIN-based: Brev publishes each port as https://<name>-<INSTANCE_ID>.brevlab.com.
//    Apps that can't serve under a sub-path (OpenShift console, OpenClaw UI) use this; we
//    ask the user for their instance ID once (stored locally) and build the URL.

const KEY = "brevInstanceId";
const EVT = "brevid:change";

type Svc = { label: string; path?: string; sub?: string; suffix?: string };
export const BREV_SERVICES: Record<string, Svc> = {
  openclaw:  { label: "OpenClaw UI", sub: "openclaw" },                           // subdomain + ID
  grafana:   { label: "Grafana", sub: "grafana" },                               // subdomain + ID
  openshift: { label: "OpenShift console", sub: "openshift", suffix: "/console/" }, // subdomain + ID
};
export type BrevService = keyof typeof BREV_SERVICES;

export function needsId(service: BrevService): boolean {
  return !BREV_SERVICES[service].path;
}

// Accept a bare ID ("agcuo13nx") or a pasted URL ("https://openshift-agcuo13nx.brevlab.com").
export function parseBrevId(raw: string): string {
  const s = (raw || "").trim();
  const m = s.match(/-([a-z0-9]+)\.brevlab\.com/i) || s.match(/^([a-z0-9]+)$/i);
  return m ? m[1] : s;
}

export function getBrevId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

export function setBrevId(raw: string) {
  window.localStorage.setItem(KEY, parseBrevId(raw));
  window.dispatchEvent(new Event(EVT));
}

// Returns a usable href, or null if a subdomain service needs an ID we don't have.
export function brevUrl(service: BrevService, id: string): string | null {
  const s = BREV_SERVICES[service];
  if (s.path) return s.path; // same-origin
  if (!id) return null;
  return `https://${s.sub}-${id}.brevlab.com${s.suffix ?? ""}`;
}

export function useBrevId(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    const sync = () => setId(getBrevId());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return id;
}
