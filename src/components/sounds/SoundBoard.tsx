import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EventRow } from "@/components/sounds/EventRow";
import { ListeningBanner } from "@/components/live/ListeningBanner";
import { useLiveHookEvents } from "@/components/live/useLiveHookEvents";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_ORDER, EventSoundConfig, HookEventType } from "@/types/soundEvents";

type Draft = Record<string, EventSoundConfig>;

export function SoundBoard() {
  const toast = useToast();
  const board = trpc.sounds.board.useQuery();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [testing, setTesting] = useState<HookEventType | null>(null);

  // Live hook traffic. Deliberately outside the draft/save cycle: it is
  // observation, never configuration, so it must not mark anything dirty.
  const live = useLiveHookEvents();
  const liveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of live.recent) counts[event.hook] = (counts[event.hook] ?? 0) + 1;
    return counts;
  }, [live.recent]);

  const save = trpc.sounds.saveConfig.useMutation();
  const preview = trpc.sounds.preview.useMutation();
  const install = trpc.sounds.install.useMutation();
  const uninstall = trpc.sounds.uninstall.useMutation();
  const reset = trpc.sounds.resetDefaults.useMutation();
  const testEvent = trpc.sounds.testEvent.useMutation();
  const setLearn = trpc.sounds.setLearnMode.useMutation();

  // Seed the local draft once the server config arrives. Editing against a
  // local copy (rather than firing a mutation per keystroke) keeps typing in
  // the message field from writing to settings.json on every character.
  useEffect(() => {
    if (board.data && draft === null) {
      setDraft(board.data.config.events as Draft);
      setGlobalEnabled(board.data.config.enabled);
    }
  }, [board.data, draft]);

  const dirtyEvents = useMemo(() => {
    if (!board.data || !draft) return new Set<string>();
    const saved = board.data.config.events as Draft;
    return new Set(
      Object.keys(draft).filter(
        (event) => JSON.stringify(draft[event]) !== JSON.stringify(saved[event])
      )
    );
  }, [board.data, draft]);

  const globalDirty = board.data ? globalEnabled !== board.data.config.enabled : false;
  const hasChanges = dirtyEvents.size > 0 || globalDirty;

  if (board.isLoading || !board.data || !draft) {
    return <div className="py-12 text-center text-muted-foreground">Loading sound settings…</div>;
  }

  const { sounds, status, events } = board.data;

  const patchEvent = (event: HookEventType, patch: Partial<EventSoundConfig>) => {
    setDraft((current) => (current ? { ...current, [event]: { ...current[event], ...patch } } : current));
  };

  const handlePreview = (soundPath: string, volume: number) => {
    if (!soundPath) return;
    preview.mutate(
      { soundPath, volume },
      { onError: (error) => toast.addToast(error.message, "error") }
    );
  };

  /**
   * Seed the draft from a freshly-fetched config.
   *
   * Deliberately not `setDraft(null)` + refetch: React re-renders immediately
   * on the null, so the seeding effect runs against the stale react-query
   * cache and restores the *old* config, leaving every row stuck dirty. Taking
   * the value from the refetch result removes the ordering assumption.
   */
  const reseedFromServer = async () => {
    const fresh = await board.refetch();
    if (fresh.data) {
      setDraft(fresh.data.config.events as Draft);
      setGlobalEnabled(fresh.data.config.enabled);
    }
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({ enabled: globalEnabled, events: draft as never });
      await reseedFromServer();
      toast.addToast("Saved and re-wired settings.json", "success");
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleDiscard = () => {
    setDraft(board.data.config.events as Draft);
    setGlobalEnabled(board.data.config.enabled);
  };

  const handleInstall = async (removeLegacy: boolean) => {
    try {
      await install.mutateAsync({ removeLegacy });
      await board.refetch();
      toast.addToast(
        removeLegacy ? "Installed and removed the old script" : "Hooky installed",
        "success"
      );
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleTest = async (event: HookEventType) => {
    setTesting(event);
    try {
      await testEvent.mutateAsync({ event });
      toast.addToast(`Fired ${event}`, "success", 2000);
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    } finally {
      setTesting(null);
    }
  };

  /**
   * Learn mode rewrites every event, so the draft has to be re-seeded from the
   * server afterwards -- otherwise all 22 rows would immediately read dirty
   * against a config the user never edited.
   */
  const handleLearnMode = async (active: boolean) => {
    try {
      await setLearn.mutateAsync({ active });
      await reseedFromServer();
      toast.addToast(
        active ? "Learn mode on — all events wired, silent" : "Learn mode off — sounds restored",
        "success"
      );
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleReset = async () => {
    try {
      await reset.mutateAsync();
      await reseedFromServer();
      toast.addToast("Restored default sounds", "success");
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const activeCount = Object.values(draft).filter((event) => event.enabled).length;

  return (
    <div className="space-y-2 pb-24">
      <StatusPanel
        status={status}
        busy={install.isPending || uninstall.isPending}
        onInstall={handleInstall}
        onUninstall={async () => {
          await uninstall.mutateAsync();
          await board.refetch();
          toast.addToast("Removed Hooky's hooks from settings.json", "info");
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-1.5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={globalEnabled}
            onChange={(e) => setGlobalEnabled(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
          <span>
            <span className="text-[13px] font-medium">All hook sounds</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {globalEnabled ? `${activeCount} of ${events.length} events active` : "Everything muted"}
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => board.refetch()}>
            ↻ Rescan sounds
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReset}>
            Restore defaults
          </Button>
        </div>
      </div>

      <ListeningBanner
        connected={live.connected}
        total={live.total}
        recent={live.recent}
        wiredEvents={status.wiredEvents}
        learnMode={board.data.learnMode}
        learnPending={setLearn.isPending}
        onToggleLearnMode={handleLearnMode}
      />

      {/* Grouped by category: 22 flat rows is a wall, and the groups match how
          you think about what you want to hear ("did an agent finish?"). */}
      {CATEGORY_ORDER.map((category) => {
        const inCategory = events.filter((entry) => entry.category === category);
        if (inCategory.length === 0) return null;

        const activeHere = inCategory.filter((entry) => draft[entry.event].enabled).length;

        return (
          <section key={category} className="space-y-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h2>
              <span className="text-[10px] text-muted-foreground">
                {activeHere}/{inCategory.length}
              </span>
            </div>

            {/* One card per category with hairline dividers, not one card per
                row. The per-row border plus the gap between rows was costing
                ~16px each and turned 22 events into four screens. */}
            <div className="divide-y divide-border/50 overflow-hidden rounded-md border border-border bg-card">
              {inCategory.map(({ event, label, when, frequency, fields }) => (
                <EventRow
                  key={event}
                  event={event}
                  meta={{ label, when, frequency, category, fields }}
                  settings={draft[event]}
                  sounds={sounds}
                  globalEnabled={globalEnabled}
                  dirty={dirtyEvents.has(event)}
                  busy={testing === event}
                  live={Boolean(live.flashing[event])}
                  liveCount={liveCounts[event] ?? 0}
                  onChange={(patch) => patchEvent(event, patch)}
                  onPreview={handlePreview}
                  onTest={() => handleTest(event)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4
          rounded-lg border border-amber-500/50 bg-card px-5 py-3 shadow-2xl">
          <span className="text-sm">
            <strong>{dirtyEvents.size + (globalDirty ? 1 : 0)}</strong> unsaved change
            {dirtyEvents.size + (globalDirty ? 1 : 0) === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface StatusPanelProps {
  status: {
    runnerInstalled: boolean;
    runnerStale: boolean;
    runnerPath: string;
    legacyEvents: string[];
    missingEvents: string[];
    inSync: boolean;
  };
  busy: boolean;
  onInstall: (removeLegacy: boolean) => void;
  onUninstall: () => void;
}

function StatusPanel({ status, busy, onInstall, onUninstall }: StatusPanelProps) {
  if (status.inSync) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-green-700/50
        bg-green-950/20 px-3 py-1.5">
        <div className="truncate text-xs">
          <span className="font-medium text-green-300">✓ Hooky is live</span>
          <span className="ml-2 text-muted-foreground">
            Your hooks call <code className="font-mono text-[10px]">{status.runnerPath}</code>
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onUninstall} disabled={busy}>
          Uninstall
        </Button>
      </div>
    );
  }

  const hasLegacy = status.legacyEvents.length > 0;

  return (
    <div className="rounded-md border border-amber-600/50 bg-amber-950/20 px-3 py-2">
      <div className="mb-3 text-sm">
        <div className="font-medium text-amber-300">
          {status.runnerInstalled ? "⚠ Hooks are out of sync" : "⚠ Hooky isn't wired up yet"}
        </div>
        <p className="mt-1 text-muted-foreground">
          {hasLegacy ? (
            <>
              {status.legacyEvents.length} event
              {status.legacyEvents.length === 1 ? " is" : "s are"} still handled by an older
              hand-written notifier script. Installing will take over those events — your sounds
              below already match what it does today, so nothing will change audibly until you
              edit them.
            </>
          ) : (
            <>
              Your settings.json doesn&apos;t call Hooky yet. Installing writes{" "}
              <code className="font-mono text-xs">{status.runnerPath}</code> and points your
              enabled hook events at it. Other hooks you&apos;ve configured are left untouched.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onInstall(hasLegacy)} disabled={busy}>
          {busy ? "Working…" : hasLegacy ? "Install & replace old script" : "Install Hooky"}
        </Button>
        {hasLegacy && (
          <Button size="sm" variant="outline" onClick={() => onInstall(false)} disabled={busy}>
            Install alongside it
          </Button>
        )}
      </div>
    </div>
  );
}
