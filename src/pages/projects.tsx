import React from "react";
import { ProjectBoard } from "@/components/projects/ProjectBoard";

export default function ProjectsPage() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-bold">📌 Project Footers</h1>
        <p className="text-xs text-muted-foreground">
          The box Claude Code prints in your terminal when a turn ends — per project, with live
          tokens and links that hide themselves when they aren&apos;t reachable.
        </p>
      </div>

      <ProjectBoard />
    </div>
  );
}
