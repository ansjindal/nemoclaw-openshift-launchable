"use client";
import { useEffect, useState } from "react";

// Reaching the instance's services from the lessons. Two strategies:
//  • PATH-based (best): same-origin path on the workshop site, proxied by Next (see
//    next.config.ts). No instance ID needed. Used for apps that serve under a sub-path
//    (Grafana via serve_from_sub_path).
//  • SUBDOMAIN-based: the instance publishes each port as
//    https://<name>-<INSTANCE_ID>.stg.apps.launchpad.nvidia.com. Apps that can't serve
//    under a sub-path (OpenShift console, OpenClaw UI) use this. The instance ID is
//    auto-detected from the workshop's own hostname (learn-<ID>.…); the user can also
//    override it once (stored locally).

const KEY = "brevInstanceId";
const EVT = "brevid:change";

// Instances are published under this domain (legacy boxes used brevlab.com).
const BREV_DOMAIN = "stg.apps.launchpad.nvidia.com";
const ID_IN_HOST = /-([a-z0-9]+)\.(?:stg\.apps\.launchpad\.nvidia\.com|brevlab\.com)/i;

type Svc = { label: string; path?: string; sub?: string; suffix?: string };
export const BREV_SERVICES: Record<string, Svc> = {
  openclaw:  { label: "OpenClaw UI", sub: "openclaw" },                           // subdomain + ID
  grafana:   { label: "Grafana", path: "/grafana" },                             // same-origin proxy (no ID)
  openshift: { label: "OpenShift console", sub: "openshift", suffix: "/console/" }, // subdomain + ID
};
export type BrevService = keyof typeof BREV_SERVICES;

export function needsId(service: BrevService): boolean {
  return !BREV_SERVICES[service].path;
}

// Accept a bare ID ("1ut2jitd") or a pasted service URL
// ("https://openshift-1ut2jitd.stg.apps.launchpad.nvidia.com").
export function parseBrevId(raw: string): string {
  const s = (raw || "").trim();
  const m = s.match(ID_IN_HOST) || s.match(/^([a-z0-9]+)$/i);
  return m ? m[1] : s;
}

// The workshop site is itself published at learn-<ID>.<domain>, so we can read the
// instance ID straight off our own hostname — no need to ask the user.
function detectId(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.hostname.match(ID_IN_HOST);
  return m ? m[1] : "";
}

export function getBrevId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || detectId();
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
  return `https://${s.sub}-${id}.${BREV_DOMAIN}${s.suffix ?? ""}`;
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
