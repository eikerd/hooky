import React, { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";
import { EVENT_META, HookEventType } from "@/types/soundEvents";

const SOURCE_LABELS: Record<string, string> = {
  System: "macOS",
  Local: "/Library/Sounds",
  User: "~/Library/Sounds",
  Custom: "~/.claude/sounds",
};

/** Longest sound in the list defines the bar scale, so durations compare visually. */
function barWidth(duration: number, longest: number): string {
  if (!duration || !longest) return "0%";
  return `${Math.max(4, Math.round((duration / longest) * 100))}%`;
}

export function SoundLibrary() {
  const toast = useToast();
  const library = trpc.sounds.library.useQuery();
  const preview = trpc.sounds.preview.useMutation();

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>("all");
  const [volume, setVolume] = useState(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sounds = library.data?.sounds ?? [];
  const usage = library.data?.usage ?? {};

  const sources = useMemo(
    () => Array.from(new Set(sounds.map((sound) => sound.source))),
    [sounds]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sounds.filter((sound) => {
      if (source !== "all" && sound.source !== source) return false;
      return !needle || sound.name.toLowerCase().includes(needle);
    });
  }, [sounds, query, source]);

  const longest = useMemo(
    () => filtered.reduce((max, sound) => Math.max(max, sound.duration), 0),
    [filtered]
  );

  // Filtering can leave the cursor past the end of the list.
  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const play = (soundPath: string) => {
    setPlaying(soundPath);
    preview.mutate(
      { soundPath, volume },
      {
        onError: (error) => toast.addToast(error.message, "error"),
        // Clearing on settle rather than on a duration timer: afplay is the
        // authority on when a file actually finished.
        onSettled: () => setPlaying((current) => (current === soundPath ? null : current)),
      }
    );
  };

  /**
   * Arrow keys move and audition in one gesture, which is the whole point of
   * this page -- 115 sounds is far too many to click through one at a time.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
    event.preventDefault();

    if (event.key === "Enter") {
      const current = filtered[cursor];
      if (current) play(current.path);
      return;
    }

    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = Math.min(filtered.length - 1, Math.max(0, cursor + delta));
    setCursor(next);
    const target = filtered[next];
    if (target) {
      play(target.path);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };

  if (library.isLoading || !library.data) {
    return <div className="py-12 text-center text-muted-foreground">Loading sounds…</div>;
  }

  return (
    <div className="space-y-2" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…  (↑ ↓ to audition)"
          className="h-8 w-56 rounded border border-border bg-input px-2 text-sm"
          aria-label="Filter sounds by name"
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          aria-label="Filter by source directory"
          className="h-8 rounded border border-border bg-input px-2 text-xs"
        >
          <option value="all">All sources ({sounds.length})</option>
          {sources.map((name) => (
            <option key={name} value={name}>
              {SOURCE_LABELS[name] ?? name} ({sounds.filter((s) => s.source === name).length})
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2" title="Preview volume">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Vol</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-24 accent-white"
            aria-label="Preview volume"
          />
          <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of {sounds.length}.
        Click a row to hear it, or use ↑/↓ to walk the list and audition as you go.
      </p>

      <div ref={listRef} className="divide-y divide-border/50 overflow-hidden rounded-md border border-border bg-card">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        )}

        {filtered.map((sound, index) => {
          const usedBy = (usage[sound.path] ?? []) as HookEventType[];
          const isPlaying = playing === sound.path;
          const isCursor = index === cursor;

          return (
            <button
              key={sound.path}
              data-index={index}
              data-sound={sound.name}
              onClick={() => {
                setCursor(index);
                play(sound.path);
              }}
              className={`flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors ${
                isPlaying
                  ? "bg-emerald-400/[0.12]"
                  : isCursor
                    ? "bg-secondary/50"
                    : "hover:bg-secondary/30"
              }`}
            >
              <span className={`w-4 shrink-0 text-xs ${isPlaying ? "text-emerald-300" : "text-muted-foreground"}`}>
                {isPlaying ? "♪" : "▶"}
              </span>

              <span className="w-52 shrink-0 truncate text-[13px]">{sound.name}</span>

              <span className="flex w-28 shrink-0 items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded bg-secondary">
                  <span
                    className={`block h-full ${isPlaying ? "bg-emerald-400" : "bg-muted-foreground/50"}`}
                    style={{ width: barWidth(sound.duration, longest) }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {sound.duration > 0 ? `${sound.duration.toFixed(1)}s` : "—"}
                </span>
              </span>

              <span className="hidden w-28 shrink-0 font-mono text-[10px] text-muted-foreground lg:block">
                {SOURCE_LABELS[sound.source] ?? sound.source}
              </span>

              {/* Which events already claim this sound. Reusing one that means
                  something else is exactly how a bell stops being a signal. */}
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {usedBy.map((event) => (
                  <span
                    key={event}
                    className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                    title={`${EVENT_META[event].label} uses this sound`}
                  >
                    {EVENT_META[event].label}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
