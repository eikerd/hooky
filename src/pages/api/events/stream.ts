import type { NextApiRequest, NextApiResponse } from "next";
import { eventLogService } from "@/server/services/eventLogService";

/**
 * Server-sent events, not a WebSocket.
 *
 * The traffic is strictly one-way (runner -> browser), SSE needs no custom
 * server in the pages router, and EventSource reconnects on its own -- so a
 * dev-server restart doesn't leave the monitor silently dead.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Next's dev proxy will buffer an event stream without this.
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  const unsubscribe = eventLogService.subscribe((event) => {
    res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  // Idle SSE connections get reaped by proxies and by macOS itself; a comment
  // frame is the cheapest thing that counts as traffic.
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
}
