import React, { useMemo } from "react";

export interface SoundOption {
  name: string;
  path: string;
  duration: number;
  source: "System" | "Local" | "User" | "Custom";
}

interface SoundSelectProps {
  value: string;
  sounds: SoundOption[];
  disabled?: boolean;
  onChange: (soundPath: string) => void;
}

const SOURCE_ORDER: SoundOption["source"][] = ["System", "Local", "User", "Custom"];

const SOURCE_LABELS: Record<SoundOption["source"], string> = {
  System: "macOS System Sounds",
  Local: "/Library/Sounds",
  User: "~/Library/Sounds",
  Custom: "~/.claude/sounds",
};

export function SoundSelect({ value, sounds, disabled, onChange }: SoundSelectProps) {
  const grouped = useMemo(() => {
    return SOURCE_ORDER.map((source) => ({
      source,
      items: sounds.filter((sound) => sound.source === source),
    })).filter((group) => group.items.length > 0);
  }, [sounds]);

  // A config may point at a file that has since been deleted or moved. Keep it
  // selectable and visibly flagged rather than silently snapping to something
  // else -- otherwise a missing file looks like a working setting.
  const isOrphan = value !== "" && !sounds.some((sound) => sound.path === value);

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      // A focused <select> changes value on scroll in Chromium/Safari, so
      // scrolling the page after opening one would silently reassign sounds
      // -- and, because selection auto-previews, play a burst of audio.
      // Blurring on wheel makes the page scroll instead.
      onWheel={(event) => event.currentTarget.blur()}
      aria-label="Notification sound"
      className={`h-7 w-40 shrink-0 rounded border bg-input px-1.5 text-xs text-foreground
        transition-colors hover:border-muted-foreground focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40
        ${isOrphan ? "border-destructive" : "border-border"}`}
    >
      <option value="">Silent (no sound)</option>

      {isOrphan && (
        <option value={value}>⚠ Missing: {value.split("/").pop()}</option>
      )}

      {grouped.map((group) => (
        <optgroup key={group.source} label={SOURCE_LABELS[group.source]}>
          {group.items.map((sound) => (
            <option key={sound.path} value={sound.path}>
              {sound.name}
              {sound.duration > 0 ? ` · ${sound.duration.toFixed(1)}s` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
