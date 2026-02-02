import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HOOK_DESCRIPTIONS } from "@/utils/hookDescriptions";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";

export default function Dashboard() {
  const [hooks, setHooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHook, setExpandedHook] = useState<string | null>(null);
  const toast = useToast();

  const listQuery = trpc.hooks.list.useQuery();
  const toggleMutation = trpc.hooks.toggle.useMutation();

  useEffect(() => {
    if (listQuery.data) {
      setHooks(listQuery.data);
      setLoading(false);
    }
  }, [listQuery.data]);

  const handleToggle = async (eventType: string, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({
        eventType: eventType as any,
        enabled: !enabled,
      });

      // Refresh the list
      const updated = hooks.map((h) =>
        h.eventType === eventType ? { ...h, enabled: !enabled } : h
      );
      setHooks(updated);
      toast.addToast(`${eventType} ${!enabled ? "enabled" : "disabled"}`, "success", 2000);
    } catch (error) {
      toast.addToast("Failed to toggle hook", "error");
      console.error(error);
    }
  };

  if (loading) {
    return <div>Loading hooks...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">⚙️ Hook Management</h1>
        <p className="text-muted-foreground">
          Configure Claude Code hooks and customize notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Hooks ({hooks.filter((h) => h.enabled).length}/{hooks.length} Enabled)</CardTitle>
          <CardDescription>
            Click a hook name to see detailed documentation below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-sm font-semibold">Event Type</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Handlers</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hooks.map((hook) => {
                  const description = HOOK_DESCRIPTIONS[hook.eventType as keyof typeof HOOK_DESCRIPTIONS];
                  return (
                    <tr key={hook.eventType} className={`border-b border-border hover:bg-accent/50 cursor-pointer transition-colors ${
                      expandedHook === hook.eventType ? "bg-secondary/50" : ""
                    }`}>
                      <td className="px-4 py-2 font-mono text-sm">
                        <button
                          onClick={() =>
                            setExpandedHook(
                              expandedHook === hook.eventType ? null : hook.eventType
                            )
                          }
                          className="hover:text-primary"
                        >
                          {expandedHook === hook.eventType ? "▼" : "▶"} {hook.eventType}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">
                        {description?.title}
                      </td>
                      <td className="px-4 py-2 text-sm text-center">{hook.handlerCount}</td>
                      <td className="px-4 py-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={hook.enabled}
                            onChange={() => handleToggle(hook.eventType, hook.enabled)}
                            className="rounded border border-input cursor-pointer"
                          />
                          <span className="text-sm">
                            {hook.enabled ? "✅" : "❌"}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/hooks/${hook.eventType}`}
                          className="text-sm text-primary hover:underline hover:text-primary/80"
                        >
                          ⚙️ Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Section */}
      {expandedHook && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-xl">
              {
                HOOK_DESCRIPTIONS[expandedHook as keyof typeof HOOK_DESCRIPTIONS]
                  ?.title
              }
            </CardTitle>
            <CardDescription>Hook: {expandedHook}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 text-primary">Description & Purpose</h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {
                  HOOK_DESCRIPTIONS[expandedHook as keyof typeof HOOK_DESCRIPTIONS]
                    ?.description
                }
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <Button
                onClick={() => setExpandedHook(null)}
                variant="ghost"
                className="text-sm"
              >
                ✕ Close Documentation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Link href="/notifications">
          <Button size="lg">🔔 Go to Notifications</Button>
        </Link>
      </div>
    </div>
  );
}
