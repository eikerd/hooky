import fs from "fs/promises";
import os from "os";
import path from "path";
import { FooterLink, ProjectFooter, emptyFooter } from "@/types/projectFooter";
import { displayPath, normalizePath } from "@/server/services/projectConfigService";

const home = os.homedir();

/**
 * Importer for the hand-rolled setup Hooky replaces.
 *
 * Two things predate this app:
 *
 *   ~/.claude/claude-notify-macos.sh   a bash case statement mapping events to
 *                                      afplay sounds
 *   <project>/.claude/footer.json      a static footer read by project-footer.sh
 *
 * Only the second needs importing. The sound half is already covered:
 * DEFAULT_SOUND_CONFIG in soundEvents.ts was written from that script's case
 * statement and reproduces it exactly, so installing Hooky with defaults *is*
 * the sound migration. Parsing the shell script back out would add a brittle
 * dependency on its formatting to re-derive values we already have.
 */

/** The legacy on-disk shape. Every field was optional there too. */
interface LegacyFooter {
  enabled?: boolean;
  icon?: string;
  title?: string;
  links?: { label?: string; url?: string }[];
  notes?: string[];
}

export interface DiscoveredFooter {
  /** Absolute project directory (the parent of .claude/). */
  projectPath: string;
  /** Tilde form, for display. */
  display: string;
  /** Where the legacy file lives, so the UI can name it. */
  sourceFile: string;
  footer: ProjectFooter;
}

/** Directories never worth descending into when hunting for .claude/footer.json. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".venv",
  "venv",
  "dist",
  "build",
  "target",
  "Library",
  "Applications",
  ".Trash",
  ".cache",
]);

export class LegacyImportService {
  /** Translate the old schema into a ProjectFooter, filling in the new fields. */
  toProjectFooter(legacy: LegacyFooter): ProjectFooter {
    const footer = emptyFooter();
    // The legacy script treated a missing `enabled` as true; only an explicit
    // false opted out. Preserve that exactly.
    footer.enabled = legacy.enabled !== false;
    footer.icon = typeof legacy.icon === "string" ? legacy.icon : "";
    footer.title = typeof legacy.title === "string" ? legacy.title : "";
    footer.notes = Array.isArray(legacy.notes)
      ? legacy.notes.filter((n): n is string => typeof n === "string")
      : [];

    // Legacy links had no conditions -- every row always rendered.
    footer.links = Array.isArray(legacy.links)
      ? legacy.links
          .filter((l): l is NonNullable<typeof l> => !!l && typeof l === "object")
          .map<FooterLink>((l) => ({
            label: typeof l.label === "string" ? l.label : "link",
            url: typeof l.url === "string" ? l.url : "",
            when: "",
          }))
          .filter((l) => l.url !== "")
      : [];

    return footer;
  }

  private async readLegacyFile(file: string): Promise<ProjectFooter | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
      if (!parsed || typeof parsed !== "object") return null;
      return this.toProjectFooter(parsed as LegacyFooter);
    } catch {
      return null;
    }
  }

  /**
   * Walk `roots` looking for <dir>/.claude/footer.json.
   *
   * Bounded by depth and by SKIP_DIRS because this runs from a UI click and
   * an unbounded walk of $HOME would hang it. Unreadable directories are
   * skipped rather than thrown on -- a permission error deep in the tree
   * should not abort the whole scan.
   */
  async discover(roots: string[], maxDepth = 4): Promise<DiscoveredFooter[]> {
    const found: DiscoveredFooter[] = [];
    const seen = new Set<string>();

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > maxDepth || seen.has(dir)) return;
      seen.add(dir);

      const candidate = path.join(dir, ".claude", "footer.json");
      const footer = await this.readLegacyFile(candidate);
      if (footer) {
        found.push({
          projectPath: dir,
          display: displayPath(dir),
          sourceFile: candidate,
          footer,
        });
      }

      if (depth === maxDepth) return;

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name), depth + 1);
      }
    };

    for (const root of roots) {
      const abs = normalizePath(root);
      try {
        if ((await fs.stat(abs)).isDirectory()) await walk(abs, 0);
      } catch {
        // Nonexistent root: skip silently, the UI lets the user pick another.
      }
    }

    return found.sort((a, b) => a.display.localeCompare(b.display));
  }

  /** Sensible starting points for a scan, in the order we'd try them. */
  defaultRoots(): string[] {
    return [path.join(home, "repos"), path.join(home, "projects"), path.join(home, "src")];
  }

  /** The global ~/.claude/footer.json, which becomes the registry's default. */
  async readGlobalDefault(): Promise<ProjectFooter | null> {
    return this.readLegacyFile(path.join(home, ".claude", "footer.json"));
  }
}

export const legacyImportService = new LegacyImportService();
