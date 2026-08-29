import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { SoundSelect, SoundOption } from "@/components/sounds/SoundSelect";
import { EventSoundConfig, EventMeta, HookEventType } from "@/types/soundEvents";

/**
 * Frequency used to be a text pill on its own line, which cost ~20px of height
 * on all 22 rows. It's a dot now: the information is "how noisy will this be",
 * which is ordinal, and an ordinal scale reads fine as colour alone once the
 * title carries the words for anyone who needs them.
 */
const FREQUENCY_STYLES: Record<EventMeta["frequency"], { label: string; dot: string }> = {
  constant: { label: "fires constantly", dot: "bg-red-400" },
  often: { label: "fires often", dot: "bg-amber-400" },
  occasional: { label: "occasional", dot: "bg-blue-400" },
  rare: { label: "rare", dot: "bg-muted-foreground/40" },
};

const QUICK_EMOJI = ["🛑", "✅", "❌", "🔔", "🔐", "▶️", "👋", "⏳", "🔧", "🤖", "📋", "📦"];

interface EventRowProps {
  event: HookEventType;
  meta: EventMeta;
  settings: EventSoundConfig;
  sounds: SoundOption[];
  globalEnabled: boolean;
  dirty: boolean;
  busy: boolean;
  /** True while this event's hook has fired within the last flash window. */
  live: boolean;
  /** How many times it has fired since the monitor connected. */
  liveCount: number;
  onChange: (patch: Partial<EventSoundConfig>) => void;
  onPreview: (soundPath: string, volume: number) => void;
  onTest: () => void;
}

export function EventRow({
  event,
  meta,
  settings,
  sounds,
  globalEnabled,
  dirty,
  busy,
  live,
  liveCount,
  onChange,
  onPreview,
  onTest,
}: EventRowProps) {
  const [expanded, setExpanded] = useState(false);

  const muted = !globalEnabled || !settings.enabled;
  const frequency = FREQUENCY_STYLES[meta.frequency];

  // Selecting a sound plays it immediately. Choosing audio blind and saving to
  // find out what it sounds like is the whole friction this app exists to remove.
  const handleSoundChange = (soundPath: string) => {
    onChange({ soundPath });
    if (soundPath) onPreview(soundPath, settings.volume);
  };

  return (
    <div
      data-event={event}
      /* Dirty is a left accent bar rather than a full border + tint: a border
         on every row is what made the list read as 22 stacked cards. */
      className={`border-l-2 transition-colors duration-150 ${
        live
          ? "border-l-emerald-400 bg-emerald-400/[0.12]"
          : dirty
            ? "border-l-amber-400 bg-amber-500/[0.04]"
            : "border-l-transparent"
      } ${muted && !live ? "opacity-50" : ""} hover:bg-secondary/30`}
    >
      <div className="flex items-center gap-2 py-1 pl-2 pr-2">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!globalEnabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          aria-label={`Enable ${meta.label}`}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-white disabled:cursor-not-allowed"
        />

        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${frequency.dot}`}
          title={frequency.label}
          aria-label={frequency.label}
        />

        <span className="w-5 shrink-0 text-center text-sm leading-none" aria-hidden>
          {settings.emoji || "•"}
        </span>

        <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">
          {meta.label}
          <span className="ml-2 hidden font-mono text-[10px] text-muted-foreground lg:inline">{event}</span>
          {liveCount > 0 && (
            <span
              className={`ml-2 rounded px-1 font-mono text-[10px] tabular-nums transition-colors ${
                live ? "bg-emerald-400/25 text-emerald-200" : "bg-secondary text-muted-foreground"
              }`}
              title={`Fired ${liveCount} time${liveCount === 1 ? "" : "s"} since the monitor connected`}
            >
              {liveCount}
            </span>
          )}
        </span>

        <SoundSelect
          value={settings.soundPath}
          sounds={sounds}
          disabled={muted}
          onChange={handleSoundChange}
        />

        <Button
          size="sm"
          variant="outline"
          disabled={!settings.soundPath}
          onClick={() => onPreview(settings.soundPath, settings.volume)}
          title="Preview this sound"
          className="h-7 w-7 shrink-0 p-0 text-xs"
        >
          ▶
        </Button>

        <div className="hidden w-24 shrink-0 items-center gap-1.5 md:flex" title="Playback volume">
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={settings.volume}
            disabled={muted || !settings.soundPath}
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
            onMouseUp={() => settings.soundPath && onPreview(settings.soundPath, settings.volume)}
            aria-label={`${meta.label} volume`}
            className="h-1 w-full accent-white disabled:opacity-40"
          />
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {Math.round(settings.volume * 100)}%
          </span>
        </div>

        <button
          onClick={() => onChange({ banner: !settings.banner })}
          disabled={muted}
          title={settings.banner ? "Banner on — click to disable" : "Banner off — click to enable"}
          className={`h-7 w-7 shrink-0 rounded border text-xs transition-colors disabled:opacity-40 ${
            settings.banner
              ? "border-border bg-secondary"
              : "border-transparent bg-transparent opacity-40"
          }`}
        >
          {settings.banner ? "🔔" : "🔕"}
        </button>

        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="h-7 w-7 shrink-0 rounded border border-transparent text-xs
            text-muted-foreground transition-colors hover:border-border hover:bg-secondary"
          title="More options"
        >
          {expanded ? "⌃" : "⌄"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 bg-background/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">{meta.when}</p>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Emoji
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <input
                  value={settings.emoji}
                  onChange={(e) => onChange({ emoji: e.target.value })}
                  placeholder="—"
                  className="h-7 w-11 rounded border border-border bg-input px-1 text-center text-sm"
                />
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onChange({ emoji })}
                    className="h-6 w-6 rounded text-sm transition-colors hover:bg-secondary"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Banner message
              </label>
              <input
                value={settings.message}
                onChange={(e) => onChange({ message: e.target.value })}
                placeholder="Message shown in the notification"
                className="h-7 w-full rounded border border-border bg-input px-2 text-xs"
              />
              {/* Only the placeholders this event's payload actually carries.
                  Offering {teammate} on Stop would just render empty. */}
              <div className="mt-1 flex flex-wrap gap-1">
                {meta.fields.map((token) => (
                  <button
                    key={token}
                    onClick={() => onChange({ message: `${settings.message}${token}` })}
                    className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]
                      text-secondary-foreground transition-colors hover:bg-muted"
                    title={`Insert ${token}`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings.includeDetails}
                onChange={(e) => onChange({ includeDetails: e.target.checked })}
                className="h-3.5 w-3.5 accent-white"
              />
              <span>Append tool / model / file details</span>
            </label>
            <Button size="sm" variant="secondary" onClick={onTest} disabled={busy} className="h-7 text-xs">
              {busy ? "Testing…" : "🧪 Test this event for real"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
