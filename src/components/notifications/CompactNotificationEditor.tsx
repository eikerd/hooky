import React, { useState, useEffect } from "react";
import { NotificationConfig, BURNT_TOAST_SOUNDS } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmojiPicker } from "./EmojiPicker";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";
import { playNotificationSound } from "@/utils/audioUtils";

export function CompactNotificationEditor() {
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
      toast.addToast("Notifications saved successfully!", "success", 3000);
    } catch (error) {
      toast.addToast("Failed to save notifications", "error");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (hookName: string, sound: NotificationConfig["sound"]) => {
    try {
      await playNotificationSound(sound);
      toast.addToast(`Playing ${sound} sound`, "success", 2000);
    } catch (error) {
      toast.addToast("Failed to play sound", "error");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading notifications...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Customize notifications for each Claude Code event - customize emoji, message, and sound
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Compact Table */}
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-3 py-2 text-left font-semibold">Event</th>
                  <th className="px-3 py-2 text-center font-semibold">Emoji</th>
                  <th className="px-2 py-2 text-left font-semibold">Message</th>
                  <th className="px-3 py-2 text-left font-semibold">Sound</th>
                  <th className="px-2 py-2 text-center font-semibold">On</th>
                  <th className="px-2 py-2 text-center font-semibold">Test</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notification, index) => (
                  <tr
                    key={notification.hookName}
                    className="border-b border-border hover:bg-secondary/30 transition-colors"
                  >
                    {/* Event Name */}
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {notification.hookName}
                    </td>

                    {/* Emoji Picker */}
                    <td className="px-3 py-2 text-center">
                      <EmojiPicker
                        value={notification.emoji}
                        onChange={(emoji) => handleEmojiChange(index, emoji)}
                      />
                    </td>

                    {/* Message Input */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={notification.message}
                        onChange={(e) => handleMessageChange(index, e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Message..."
                      />
                    </td>

                    {/* Sound Select */}
                    <td className="px-3 py-2">
                      <select
                        value={notification.sound}
                        onChange={(e) =>
                          handleSoundChange(index, e.target.value as NotificationConfig["sound"])
                        }
                        className="w-full px-2 py-1 rounded border border-border bg-secondary text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        style={{ colorScheme: 'dark' }}
                      >
                        {BURNT_TOAST_SOUNDS.map((sound) => (
                          <option key={sound} value={sound} style={{ background: '#222', color: '#fff' }}>
                            {sound}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Enabled Checkbox */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={notification.enabled}
                        onChange={(e) => handleEnabledChange(index, e.target.checked)}
                        className="rounded border border-border cursor-pointer w-4 h-4"
                      />
                    </td>

                    {/* Test Button */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest(notification.hookName, notification.sound)}
                          className="text-xs h-7 px-2"
                          title="Play the notification sound"
                        >
                          🔊
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            toast.addToast(`${notification.emoji} ${notification.message}`, "info", 3000);
                          }}
                          className="text-xs h-7 px-2"
                          title="Show notification in UI"
                        >
                          📢
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? "Saving..." : "💾 Save & Generate Scripts"}
            </Button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-3">
            💡 <strong>Tip:</strong> Click the emoji box to choose from a grid of emojis. Click "Test" to
            play a notification sound. Changes are saved to your Claude configuration and PowerShell
            script.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
