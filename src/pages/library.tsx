import React from "react";
import { SoundLibrary } from "@/components/sounds/SoundLibrary";

export default function LibraryPage() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-bold">🎵 Sound Library</h1>
        <p className="text-xs text-muted-foreground">
          Every playable sound on this Mac. Click to hear it; badges show which events already use
          it.
        </p>
      </div>

      <SoundLibrary />
    </div>
  );
}
