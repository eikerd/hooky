import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FooterEditor } from "@/components/projects/FooterEditor";
import { ImportPanel } from "@/components/projects/ImportPanel";
import { TerminalPreview, ShellToggle, Shell } from "@/components/projects/TerminalPreview";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/utils/trpc";
import { ProjectFooter } from "@/types/projectFooter";

type Drafts = Record<string, ProjectFooter>;

export function ProjectBoard() {
  const toast = useToast();
  const board = trpc.projects.board.useQuery();

  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [newPath, setNewPath] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [shell, setShell] = useState<Shell>("zsh");
  const [comparing, setComparing] = useState(false);

  const save = trpc.projects.save.useMutation();
  const add = trpc.projects.add.useMutation();
  const remove = trpc.projects.remove.useMutation();
  const setGlobal = trpc.projects.setGlobalEnabled.useMutation();
  const preview = trpc.projects.preview.useMutation();

  // Seed local drafts once, then edit against the copy -- same reasoning as
  // SoundBoard: a mutation per keystroke would rewrite the config file while
  // you're still typing a URL.
  useEffect(() => {
    if (board.data && drafts === null) {
      setDrafts(Object.fromEntries(board.data.projects.map((p) => [p.projectPath, p.footer])));
    }
  }, [board.data, drafts]);

  const dirty = useMemo(() => {
    if (!board.data || !drafts) return new Set<string>();
    const saved = Object.fromEntries(board.data.projects.map((p) => [p.projectPath, p.footer]));
    return new Set(
      Object.keys(drafts).filter(
        (key) => JSON.stringify(drafts[key]) !== JSON.stringify(saved[key])
      )
    );
  }, [board.data, drafts]);

  if (board.isLoading || !board.data || !drafts) {
    return <div className="py-12 text-center text-muted-foreground">Loading projects…</div>;
  }

  const { projects, enabled, status } = board.data;

  const reseed = async () => {
    const fresh = await board.refetch();
    if (fresh.data) {
      setDrafts(Object.fromEntries(fresh.data.projects.map((p) => [p.projectPath, p.footer])));
    }
  };

  const patch = (projectPath: string, delta: Partial<ProjectFooter>) => {
    setDrafts((current) =>
      current ? { ...current, [projectPath]: { ...current[projectPath]!, ...delta } } : current
    );
  };

  const handleSave = async (projectPath: string) => {
    try {
      await save.mutateAsync({ projectPath, footer: drafts[projectPath]! });
      await reseed();
      toast.addToast("Footer saved", "success", 2000);
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleAdd = async () => {
    if (!newPath.trim()) return;
    try {
      await add.mutateAsync({ projectPath: newPath.trim() });
      setNewPath("");
      await reseed();
      toast.addToast("Project added", "success", 2000);
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleRemove = async (projectPath: string, display: string) => {
    try {
      await remove.mutateAsync({ projectPath });
      await reseed();
      toast.addToast(`Removed ${display}`, "info", 2500);
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  /**
   * Render every registered footer through the real runner, so they can be read
   * side by side. Sequential rather than Promise.all: each preview spawns bash
   * and a `port:` condition can open sockets, and firing 20 of those at once to
   * populate a comparison view is a lot of work for a glance.
   */
  const handleCompareAll = async () => {
    setComparing(true);
    for (const project of projects) {
      await handlePreview(project.projectPath);
    }
  };

  /**
   * Previewing has to persist the draft first: the runner reads config from
   * disk, so an unsaved edit would render the previous version. Saving is
   * cheap and idempotent here, and it makes "what you see" literally true.
   */
  const handlePreview = async (projectPath: string) => {
    setPreviewing(projectPath);
    setPreviewErrors((current) => ({ ...current, [projectPath]: "" }));
    try {
      await save.mutateAsync({ projectPath, footer: drafts[projectPath]! });
      const result = await preview.mutateAsync({ projectPath });
      setPreviews((current) => ({ ...current, [projectPath]: result.rendered }));
      await reseed();
    } catch (error) {
      setPreviewErrors((current) => ({
        ...current,
        [projectPath]: (error as Error).message,
      }));
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <div className="space-y-2">
      {!status.runnerInstalled && (
        <div className="rounded-md border border-amber-600/50 bg-amber-950/20 px-3 py-2 text-xs">
          <div className="font-medium text-amber-300">⚠ The runner isn&apos;t installed</div>
          <p className="mt-1 text-muted-foreground">
            Footers are drawn by the same script that plays hook sounds. Install it from the{" "}
            <strong>Sounds</strong> page and these will start appearing when a turn ends.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={async (e) => {
              await setGlobal.mutateAsync({ enabled: e.target.checked });
              await board.refetch();
            }}
            className="h-4 w-4 accent-white"
          />
          <span>
            <span className="text-[13px] font-medium">Project footers</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {enabled
                ? `${projects.filter((p) => p.footer.enabled).length} of ${projects.length} active`
                : "All footers hidden"}
            </span>
          </span>
        </label>

        <span className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground lg:inline">
            Drawn on <code className="font-mono">Stop</code>, when a turn ends
          </span>
          <ShellToggle shell={shell} onChange={setShell} />
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={projects.length === 0 || previewing !== null}
            onClick={handleCompareAll}
          >
            {previewing ? "Rendering…" : "🖥 Compare in terminal"}
          </Button>
        </span>
      </div>

      {/* Every footer rendered by the real runner, side by side. Reading them
          together is the only way to notice that four projects all open with
          the same three words, or that one is twice the height of the rest. */}
      {comparing && projects.length > 0 && (
        <div className="grid gap-2 lg:grid-cols-2">
          {projects.map((project) => (
            <TerminalPreview
              key={project.projectPath}
              title={project.footer.title || project.display.split("/").pop()}
              content={previews[project.projectPath] ?? ""}
              shell={shell}
              dir={project.projectPath.split("/").filter(Boolean).pop() || "~"}
              pending={previewing === project.projectPath}
              compact
            />
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No projects registered yet. Add one below, or import the{" "}
            <code className="font-mono text-xs">.claude/footer.json</code> files you already have.
          </p>
        </div>
      )}

      {projects.map(({ projectPath, display }) => {
        const draft = drafts[projectPath];
        if (!draft) return null;
        const isOpen = open === projectPath;
        const isDirty = dirty.has(projectPath);

        return (
          <div
            key={projectPath}
            data-project={projectPath}
            className={`rounded-lg border transition-colors ${
              isDirty ? "border-amber-500/50 bg-amber-500/[0.03]" : "border-border bg-card"
            } ${draft.enabled && enabled ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={!enabled}
                onChange={(e) => patch(projectPath, { enabled: e.target.checked })}
                aria-label={`Enable footer for ${display}`}
                className="h-4 w-4 shrink-0 cursor-pointer accent-white disabled:cursor-not-allowed"
              />

              <span className="w-6 shrink-0 text-center text-base" aria-hidden>
                {draft.icon || "•"}
              </span>

              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-medium">
                  {draft.title || display.split("/").pop()}
                </span>
                <span className="ml-2 hidden font-mono text-[10px] text-muted-foreground lg:inline">
                  {display}
                </span>
              </div>

              <span className="text-[11px] text-muted-foreground">
                {draft.links.length} link{draft.links.length === 1 ? "" : "s"}
                {draft.meta.length > 0 && ` · ${draft.meta.length} status`}
              </span>

              {isDirty && (
                <Button size="sm" onClick={() => handleSave(projectPath)} disabled={save.isPending}>
                  Save
                </Button>
              )}

              <button
                onClick={() => handleRemove(projectPath, display)}
                className="h-7 w-7 rounded border border-border text-xs text-muted-foreground
                  transition-colors hover:bg-destructive/20 hover:text-red-300"
                title="Remove this project"
              >
                🗑
              </button>

              <button
                onClick={() => setOpen(isOpen ? null : projectPath)}
                aria-expanded={isOpen}
                className="h-7 w-7 rounded border border-border text-xs text-muted-foreground
                  transition-colors hover:bg-secondary"
                title="Edit footer"
              >
                {isOpen ? "⌃" : "⌄"}
              </button>
            </div>

            {isOpen && (
              <FooterEditor
                footer={draft}
                onChange={(delta) => patch(projectPath, delta)}
                preview={previews[projectPath] ?? null}
                previewPending={previewing === projectPath}
                previewError={previewErrors[projectPath] || null}
                projectPath={projectPath}
                onPreview={() => handlePreview(projectPath)}
              />
            )}
          </div>
        );
      })}

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Add a project
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="~/repos/my-project"
            className="h-9 min-w-[280px] flex-1 rounded-md border border-border bg-input px-3 font-mono text-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={add.isPending || !newPath.trim()}>
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sessions in subdirectories inherit this footer. If you register a path inside another,
          the innermost one wins.
        </p>
      </div>

      <ImportPanel onImported={reseed} />
    </div>
  );
}
