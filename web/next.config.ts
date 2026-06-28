import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // node-pty is a native addon used only by the custom server (server.mjs) at runtime.
  // @grpc/* are used only by the draft-policy BFF route (server-side) — keep them out of
  // the bundler so proto-loader resolves the vendored .proto files at runtime.
  serverExternalPackages: ["node-pty", "@grpc/grpc-js", "@grpc/proto-loader"],
  // Proxy Grafana same-origin under /grafana (Grafana runs with serve_from_sub_path on
  // host NodePort 30030). Lets the workshop site link to /grafana — one Brev URL, no
  // separate grafana tunnel.
  async rewrites() {
    const GRAFANA = process.env.GRAFANA_ORIGIN || "http://127.0.0.1:30030";
    return [
      { source: "/grafana", destination: `${GRAFANA}/grafana` },
      { source: "/grafana/:path*", destination: `${GRAFANA}/grafana/:path*` },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
