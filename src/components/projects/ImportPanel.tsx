import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/utils/trpc";
import { ProjectFooter } from "@/types/projectFooter";

interface Discovered {
  projectPath: string;
  display: string;
  sourceFile: string;
  footer: ProjectFooter;
  alreadyRegistered: boolean;
}

/**
 * Imports the pre-Hooky setup: .claude/footer.json files scattered across the
 * filesystem, plus the global ~/.claude/footer.json.
 *
 * Discovery is explicit rather than automatic on page load, because it walks
 * the filesystem and the user should decide when to pay for that.
 */
export function ImportPanel({ onImported }: { onImported: () => Promise<void> }) {
  const toast = useToast();
  const [roots, setRoots] = useState("");
  const [found, setFound] = useState<Discovered[] | null>(null);
  const [globalDefault, setGlobalDefault] = useState<ProjectFooter | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [takeDefault, setTakeDefault] = useState(true);

  const discover = trpc.projects.discover.useMutation();
  const importFooters = trpc.projects.importFooters.useMutation();

  const handleScan = async () => {
    try {
      const result = await discover.mutateAsync({
        roots: roots.trim() ? roots.split(",").map((r) => r.trim()) : undefined,
      });
      setFound(result.found as Discovered[]);
      setGlobalDefault(result.globalDefault);
      // Pre-select only what isn't already registered, so a second scan after
      // a partial import doesn't invite you to overwrite your edits.
      setSelected(
        new Set(
          result.found.filter((f) => !f.alreadyRegistered).map((f) => f.projectPath)
        )
      );
      if (result.found.length === 0 && !result.globalDefault) {
        toast.addToast(`Nothing found under ${result.roots.join(", ")}`, "info", 4000);
      }
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const handleImport = async () => {
    if (!found) return;
    const entries = found
      .filter((f) => selected.has(f.projectPath))
      .map((f) => ({ projectPath: f.projectPath, footer: f.footer }));

    if (entries.length === 0 && !(takeDefault && globalDefault)) {
      toast.addToast("Nothing selected", "info", 2500);
      return;
    }

    try {
      await importFooters.mutateAsync({
        entries,
        ...(takeDefault && globalDefault ? { globalDefault } : {}),
      });
      await onImported();
      setFound(null);
      toast.addToast(`Imported ${entries.length} footer${entries.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      toast.addToast((error as Error).message, "error");
    }
  };

  const toggle = (projectPath: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(projectPath)) next.delete(projectPath);
      else next.add(projectPath);
      return next;
    });
  };

  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer p-4 text-sm font-medium">
        📥 Import existing <code className="font-mono text-xs">footer.json</code> files
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Scans for <code className="font-mono">.claude/footer.json</code> written for the older
          <code className="ml-1 font-mono">project-footer.sh</code> hook. Skips{" "}
          <code className="font-mono">node_modules</code>, dotfiles and other heavy directories,
          and goes four levels deep.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            value={roots}
            onChange={(e) => setRoots(e.target.value)}
            placeholder="~/repos, ~/projects  (leave blank for the defaults)"
            className="h-9 min-w-[280px] flex-1 rounded-md border border-border bg-input px-3 font-mono text-xs"
          />
          <Button size="sm" variant="secondary" onClick={handleScan} disabled={discover.isPending}>
            {discover.isPending ? "Scanning…" : "Scan"}
          </Button>
        </div>

        {found && (
          <div className="space-y-2">
            {globalDefault && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5">
                <input
                  type="checkbox"
                  checked={takeDefault}
                  onChange={(e) => setTakeDefault(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-white"
                />
                <span className="text-xs">
                  <span className="font-medium">
                    {globalDefault.icon} {globalDefault.title || "Global default"}
                  </span>
                  <span className="ml-2 font-mono text-muted-foreground">~/.claude/footer.json</span>
                  <p className="mt-0.5 text-muted-foreground">
                    Becomes the fallback footer for sessions in unregistered directories.
                  </p>
                </span>
              </label>
            )}

            {found.length === 0 && !globalDefault && (
              <p className="text-xs text-muted-foreground">No footer.json files found.</p>
            )}

            {found.map((entry) => (
              <label
                key={entry.projectPath}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(entry.projectPath)}
                  onChange={() => toggle(entry.projectPath)}
                  className="mt-0.5 h-4 w-4 accent-white"
                />
                <span className="min-w-0 flex-1 text-xs">
                  <span className="font-medium">
                    {entry.footer.icon} {entry.footer.title || entry.display.split("/").pop()}
                  </span>
                  {entry.alreadyRegistered && (
                    <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/15
                      px-1.5 py-0.5 text-[10px] text-amber-300">
                      already registered — importing overwrites
                    </span>
                  )}
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {entry.display}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {entry.footer.links.length} link
                    {entry.footer.links.length === 1 ? "" : "s"}
                    {entry.footer.notes.length > 0 &&
                      `, ${entry.footer.notes.length} note${entry.footer.notes.length === 1 ? "" : "s"}`}
                  </div>
                </span>
              </label>
            ))}

            <Button size="sm" onClick={handleImport} disabled={importFooters.isPending}>
              {importFooters.isPending ? "Importing…" : "Import selected"}
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
