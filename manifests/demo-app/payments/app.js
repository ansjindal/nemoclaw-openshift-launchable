"use strict";
// payments — shop-app's real downstream dependency. A tiny zero-dependency HTTP service that
// "charges" on POST /charge (200). It's a real Service+Deployment, so taking it down for real
// (kubectl scale deploy/payments --replicas=0) makes shop-app's checkout calls genuinely fail
// (connection refused) — a real dependency outage, not a flag. Scaling it back up is the real fix.
const http = require("http");
http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (p === "/charge" || p === "/") {
    setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, charged: true, ts: Date.now() })); }, 8 + Math.floor(Math.random() * 22));
    return;
  }
  res.writeHead(404); res.end("not found");
}).listen(8080, () => console.log(JSON.stringify({ level: "info", msg: "payments listening", port: 8080 })));
