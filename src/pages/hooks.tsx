import React from "react";
import { trpc } from "@/utils/trpc";
import { EVENT_META, HOOK_EVENTS_ORDERED, HookEventType } from "@/types/soundEvents";
import { ListeningBanner } from "@/components/live/ListeningBanner";
import { useLiveHookEvents } from "@/components/live/useLiveHookEvents";

/**
 * Read-only view of what's actually wired in settings.json, lit up live.
 *
 * Deliberately not editable: the old version of this page toggled hooks
 * directly, which is what surfaced the settings-stripping data loss. Sound
 * wiring flows through the Sounds page; anything else belongs in your editor.
 *
 * The live highlight is the reason to look at this page rather than the file:
 * it answers "is this wired?" and "did it just fire?" in the same glance, which
 * is exactly the pair that makes an unwired event look like an event that never
 * happens.
 */
export default function HooksPage() {
  const settings = trpc.config.read.useQuery();
  const openInEditor = trpc.config.openInVSCode.useMutation();
  const live = useLiveHookEvents();

  const hooks = settings.data?.hooks ?? {};
  const wiredEvents = HOOK_EVENTS_ORDERED.filter((event) => (hooks[event] ?? []).length > 0);

  const counts: Record<string, number> = {};
  for (const event of live.recent) counts[event.hook] = (counts[event.hook] ?? 0) + 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-bold">🪝 Wired Hooks</h1>
        <p className="text-xs text-muted-foreground">
          What <code className="font-mono">~/.claude/settings.json</code> runs for each event.
          Rows light up as hooks fire. Read-only — edit sounds on the Sounds page.
        </p>
        <button
          onClick={() => openInEditor.mutate()}
          className="ml-auto rounded border border-border px-2 py-0.5 text-xs
            text-muted-foreground transition-colors hover:bg-secondary"
        >
          🔧 settings.json
        </button>
      </div>

      <ListeningBanner
        connected={live.connected}
        total={live.total}
        recent={live.recent}
        wiredEvents={wiredEvents}
      />

      {settings.isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      <div className="divide-y divide-border/50 overflow-hidden rounded-md border border-border bg-card">
        {HOOK_EVENTS_ORDERED.map((event) => (
          <HookRow
            key={event}
            event={event}
            commands={(hooks[event] ?? []).flatMap((group) => group.hooks ?? [])}
            live={Boolean(live.flashing[event])}
            fireCount={counts[event] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

interface HookRowProps {
  event: HookEventType;
  commands: { command?: string; prompt?: string; type?: string }[];
  live: boolean;
  fireCount: number;
}

function HookRow({ event, commands, live, fireCount }: HookRowProps) {
  const wired = commands.length > 0;

  return (
    <div
      data-event={event}
      data-wired={wired}
      className={`flex items-center gap-2 border-l-2 px-2 py-1 transition-colors duration-150 ${
        live ? "border-l-emerald-400 bg-emerald-400/[0.12]" : "border-l-transparent"
      } ${!wired && !live ? "opacity-45" : ""} hover:bg-secondary/30`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          wired ? "bg-emerald-400/70" : "bg-muted-foreground/30"
        }`}
        title={wired ? "Wired in settings.json" : "Not wired — this can never fire"}
      />

      <span className="w-44 shrink-0 truncate text-[13px]">{EVENT_META[event].label}</span>
      <span className="hidden w-40 shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:block">
        {event}
      </span>

      {fireCount > 0 && (
        <span
          className={`shrink-0 rounded px-1 font-mono text-[10px] tabular-nums ${
            live ? "bg-emerald-400/25 text-emerald-200" : "bg-secondary text-muted-foreground"
          }`}
          title={`Fired ${fireCount} time${fireCount === 1 ? "" : "s"} since the monitor connected`}
        >
          {fireCount}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {!wired && <span className="text-[11px] text-muted-foreground">not wired</span>}
        {commands.map((hook, index) => {
          const command = hook.command ?? hook.prompt ?? "(no command)";
          const isHooky = command.includes("hooky-notify.sh");
          return (
            <span
              key={index}
              // Full path in the tooltip, basename inline: the paths are long
              // and identical across rows, so showing them in full is 22 lines
              // of the same string.
              title={command}
              className={`truncate rounded px-1.5 py-0.5 font-mono text-[10px] ${
                isHooky
                  ? "bg-emerald-900/40 text-emerald-300"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {isHooky ? "hooky" : command.split("/").pop()}
            </span>
          );
        })}
      </span>
    </div>
  );
}
