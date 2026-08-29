import { useEffect, useRef, useState } from "react";

export interface LiveHookEvent {
  id: number;
  at: number;
  hook: string;
  tool: string;
  model: string;
  cwd: string;
}

/** How long a row stays lit after its event fires. */
const FLASH_MS = 1400;

interface LiveState {
  connected: boolean;
  /** event name -> timestamp of its most recent fire, for the row flash. */
  flashing: Record<string, number>;
  /** Newest-first tape of what happened, capped. */
  recent: LiveHookEvent[];
  /** Total seen this session, including entries trimmed off `recent`. */
  total: number;
}

const MAX_RECENT = 60;

/**
 * Subscribes to /api/events/stream and exposes what's firing right now.
 *
 * Flash expiry runs on a single shared interval rather than a timer per event:
 * PreToolUse alone can fire dozens of times a second during a busy turn, and a
 * setTimeout each would be a scheduler storm for a purely visual effect.
 */
export function useLiveHookEvents(): LiveState {
  const [state, setState] = useState<LiveState>({
    connected: false,
    flashing: {},
    recent: [],
    total: 0,
  });
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    sourceRef.current = source;

    source.onopen = () => setState((s) => ({ ...s, connected: true }));
    // EventSource retries on its own; reflect the gap rather than tearing down.
    source.onerror = () => setState((s) => ({ ...s, connected: false }));

    source.onmessage = (message) => {
      let event: LiveHookEvent;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      setState((s) => ({
        connected: true,
        flashing: { ...s.flashing, [event.hook]: Date.now() },
        recent: [event, ...s.recent].slice(0, MAX_RECENT),
        total: s.total + 1,
      }));
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setState((s) => {
        const cutoff = Date.now() - FLASH_MS;
        const live = Object.entries(s.flashing).filter(([, at]) => at > cutoff);
        // Same length means nothing expired -- return the old object so React
        // can bail out instead of re-rendering 22 rows five times a second.
        if (live.length === Object.keys(s.flashing).length) return s;
        return { ...s, flashing: Object.fromEntries(live) };
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return state;
}
