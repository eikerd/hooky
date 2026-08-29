import React from "react";
import { SoundBoard } from "@/components/sounds/SoundBoard";

export default function SoundsPage() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-bold">🔊 Hook Sounds</h1>
        <p className="text-xs text-muted-foreground">
          Pick a sound for each Claude Code event. Selecting one plays it immediately.
        </p>
      </div>

      <SoundBoard />
    </div>
  );
}
