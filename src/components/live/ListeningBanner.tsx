import React, { useEffect, useState } from "react";
import { HOOK_EVENTS_ORDERED } from "@/types/soundEvents";
import type { LiveHookEvent } from "@/components/live/useLiveHookEvents";

interface ListeningBannerProps {
  connected: boolean;
  total: number;
  recent: LiveHookEvent[];
  /** Events currently present in settings.json -- the only ones that can fire. */
  wiredEvents: string[];
  /** Learn mode is a sound-config concern, so pages that don't own it omit these. */
  learnMode?: boolean;
  learnPending?: boolean;
  onToggleLearnMode?: (active: boolean) => void;
}

function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 1) return "now";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

export function ListeningBanner({
  connected,
  total,
  recent,
  wiredEvents,
  learnMode,
  learnPending,
  onToggleLearnMode,
}: ListeningBannerProps) {
  const [open, setOpen] = useState(false);

  // The tape shows relative times, so it has to re-render even when no event
  // arrives -- otherwise every row reads "now" forever.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  /**
   * An unwired event cannot appear here, because the runner is never invoked
   * for it -- that is the whole point of removing disabled events from
   * settings.json rather than letting them exit early. Saying so explicitly
   * stops the monitor from reading as "PreToolUse never happens".
   */
  const unwired = HOOK_EVENTS_ORDERED.filter((event) => !wiredEvents.includes(event));

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/40"
            }`}
          />
          <span className="text-sm font-medium">
            {connected ? "Listening for hook events" : "Not listening"}
          </span>
        </span>

        <span className="text-xs text-muted-foreground">
          {connected ? (
            total > 0 ? (
              <>
                <strong className="text-foreground">{total}</strong> hook
                {total === 1 ? "" : "s"} fired since connecting
              </>
            ) : (
              "nothing has fired yet — use Claude Code in another terminal"
            )
          ) : (
            "reconnecting to the event stream…"
          )}
        </span>

        {unwired.length > 0 && (
          <span
            className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
            title={`Not wired in settings.json, so these can never appear here: ${unwired.join(", ")}`}
          >
            {unwired.length} event{unwired.length === 1 ? "" : "s"} unwired
          </span>
        )}

        {onToggleLearnMode && (
        <button
          onClick={() => onToggleLearnMode(!learnMode)}
          disabled={learnPending}
          title={
            learnMode
              ? "Restore the exact sound config you had before learn mode"
              : "Wire all 22 events silently so the whole lifecycle is observable (~26ms per tool call)"
          }
          className={`ml-auto rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
            learnMode
              ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          {learnPending ? "…" : learnMode ? "🎓 Learn mode on — turn off" : "🎓 Learn mode"}
        </button>
        )}

        <button
          onClick={() => setOpen((value) => !value)}
          className={`${onToggleLearnMode ? "" : "ml-auto "}rounded border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary`}
          aria-expanded={open}
        >
          {open ? "Hide tape" : "Show tape"}
        </button>
      </div>

      {learnMode && (
        <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          All 22 events are wired and silent. Sounds and banners are paused, not lost — turning
          learn mode off restores your exact previous config.
        </p>
      )}

      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-border/60">
          {recent.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nothing yet. Use Claude Code in another terminal and watch the rows light up.
            </p>
          ) : (
            <table className="w-full text-left font-mono text-[11px]">
              <tbody className="divide-y divide-border/40">
                {recent.map((event) => (
                  <tr key={event.id} className="hover:bg-secondary/30">
                    <td className="w-12 px-3 py-1 text-muted-foreground tabular-nums">
                      {ago(event.at, now)}
                    </td>
                    <td className="py-1 pr-3 font-medium">{event.hook}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{event.tool}</td>
                    <td className="truncate py-1 pr-3 text-muted-foreground">
                      {event.cwd.split("/").pop()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
