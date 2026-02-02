import React, { useState, useEffect } from "react";
import { NotificationConfig, BURNT_TOAST_SOUNDS } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";

export function NotificationEditor() {
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const listQuery = trpc.notifications.list.useQuery();
  const updateMutation = trpc.notifications.update.useMutation();
  const testMutation = trpc.notifications.test.useMutation();

  useEffect(() => {
    if (listQuery.data) {
      setNotifications(listQuery.data);
      setLoading(false);
    }
  }, [listQuery.data]);

  const handleEmojiChange = (index: number, emoji: string) => {
    const updated = [...notifications];
    updated[index].emoji = emoji;
    setNotifications(updated);
  };

  const handleMessageChange = (index: number, message: string) => {
    const updated = [...notifications];
    updated[index].message = message;
    setNotifications(updated);
  };

  const handleSoundChange = (index: number, sound: NotificationConfig["sound"]) => {
    const updated = [...notifications];
    updated[index].sound = sound;
    setNotifications(updated);
  };

  const handleEnabledChange = (index: number, enabled: boolean) => {
    const updated = [...notifications];
    updated[index].enabled = enabled;
    setNotifications(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync(notifications);
      // Show success toast
      alert("Notifications saved successfully!");
    } catch (error) {
      alert("Failed to save notifications");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (hookName: string) => {
    try {
      await testMutation.mutateAsync({ hookName });
      alert(`Test notification sent for ${hookName}`);
    } catch (error) {
      alert(`Failed to test notification: ${error}`);
    }
  };

  if (loading) {
    return <div>Loading notifications...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Customize notifications for each Claude Code event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.map((notification, index) => (
            <div
              key={notification.hookName}
              className="flex items-center gap-4 rounded-lg border border-border p-4"
            >
              <div className="flex-1">
                <h4 className="font-medium">{notification.hookName}</h4>

                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Emoji</label>
                    <input
                      type="text"
                      value={notification.emoji}
                      onChange={(e) =>
                        handleEmojiChange(index, e.target.value.charAt(0))
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1"
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Message</label>
                    <input
                      type="text"
                      value={notification.message}
                      onChange={(e) => handleMessageChange(index, e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Sound</label>
                    <select
                      value={notification.sound}
                      onChange={(e) =>
                        handleSoundChange(
                          index,
                          e.target.value as NotificationConfig["sound"]
                        )
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1"
                    >
                      {BURNT_TOAST_SOUNDS.map((sound) => (
                        <option key={sound} value={sound}>
                          {sound}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notification.enabled}
                      onChange={(e) => handleEnabledChange(index, e.target.checked)}
                      className="rounded border border-input"
                    />
                    Enabled
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(notification.hookName)}
                  disabled={testMutation.isPending}
                >
                  Test
                </Button>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save & Generate"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
