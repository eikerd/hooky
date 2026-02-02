import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SystemSoundsTable } from "@/components/systemSounds/SystemSoundsTable";

export default function SystemSoundsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">🔊 System Sounds</h1>
        <p className="text-muted-foreground">
          Browse and preview macOS system sounds for use in notifications
        </p>
      </div>

      <SystemSoundsTable />

      <div className="flex gap-4">
        <Link href="/notifications">
          <Button variant="outline">← Back to Notifications</Button>
        </Link>
      </div>
    </div>
  );
}
