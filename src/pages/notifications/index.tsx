import React from "react";
import { CompactNotificationEditor } from "@/components/notifications/CompactNotificationEditor";

export default function NotificationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">🔔 Notifications</h1>
        <p className="text-muted-foreground">
          Customize notification behavior for Claude Code events - set emoji, messages, and sounds
        </p>
      </div>

      <CompactNotificationEditor />
    </div>
  );
}
