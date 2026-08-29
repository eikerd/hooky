/**
 * Per-project footer metadata: the in-terminal box Claude Code prints when a
 * turn ends.
 *
 * This is a different output channel from the macOS banners in soundEvents.ts,
 * and the distinction drives most of the design:
 *
 *   banner -> terminal-notifier, backgrounded, fire-and-forget, any event
 *   footer -> the runner's stdout as {systemMessage, suppressOutput}, which
 *             Claude Code parses. Synchronous, and only meaningful on Stop.
 *
 * Config lives at ~/.claude/hooky-projects.json keyed by absolute project
 * directory, and is read by the runner at fire time -- same split as
 * hooky.json, so hand-editing works and takes effect on the next turn with no
 * reinstall.
 *
 * DELIBERATELY NO GIT. An earlier draft resolved {git.branch}/{git.dirty} by
 * shelling out to git, which meant spawning subprocesses on every single turn
 * to report something the prompt already shows. The footer identifies *where
 * you are*, not what the repo is doing. Every token below resolves from the
 * hook payload or plain string work, so drawing a footer costs no processes at
 * all -- only the optional port/file link conditions ever touch the system.
 */

/** A single link row. */
export interface FooterLink {
  label: string;
  url: string;
  /**
   * Render this row only when the condition holds; "" means always. Conditions
   * are a fixed vocabulary the runner evaluates itself (see FOOTER_CONDITIONS)
   * -- never shell, because this file is read on Claude Code's critical path
   * and a project config should not be executable code.
   */
  when: string;
}

export interface ProjectFooter {
  enabled: boolean;
  icon: string;
  /** Falls back to the directory basename when empty. */
  title: string;
  /** Dynamic status lines, rendered above the links. */
  meta: string[];
  links: FooterLink[];
  /** Static lines, rendered below the links. */
  notes: string[];
}

export interface HookyProjectsConfig {
  version: 1;
  /** Global switch for the footer feature, independent of sounds. */
  enabled: boolean;
  /** Used when no project entry matches the session cwd. null = stay silent. */
  default: ProjectFooter | null;
  /**
   * Keyed by absolute project directory. A session in a subdirectory inherits
   * its project's footer, and when entries nest the longest match wins.
   */
  projects: Record<string, ProjectFooter>;
}

export interface TokenMeta {
  token: string;
  describe: string;
}

/**
 * The complete token vocabulary. Everything resolves from the hook payload or
 * from the matched path itself -- no subprocesses, no escape hatch for
 * arbitrary commands.
 */
export const FOOTER_TOKENS: TokenMeta[] = [
  { token: "{project}", describe: "Project title (or directory name)" },
  { token: "{dir}", describe: "Name of the working directory" },
  { token: "{cwd}", describe: "Full working directory of this session" },
  { token: "{root}", describe: "The registered project path" },
  { token: "{rel}", describe: "Working directory relative to the project root" },
  { token: "{model}", describe: "Model that handled this turn" },
  { token: "{date}", describe: "Today, as YYYY-MM-DD" },
  { token: "{time}", describe: "Now, as HH:MM" },
];

/** Condition vocabulary for FooterLink.when. Prefix with ! to negate. */
export const FOOTER_CONDITIONS: { value: string; label: string }[] = [
  { value: "", label: "Always show" },
  { value: "port:3000", label: "port:PORT — something is listening locally" },
  { value: "file:README.md", label: "file:PATH — path exists in the project" },
  { value: "env:NAME", label: "env:NAME — environment variable is set" },
];

export function emptyFooter(): ProjectFooter {
  return {
    enabled: true,
    icon: "",
    title: "",
    meta: [],
    links: [],
    notes: [],
  };
}

/**
 * A starter footer for a newly added project: the title plus where in the tree
 * this session actually is, which is the thing the footer exists to answer.
 * {rel} renders empty at the project root, so the line stays quiet until you
 * are somewhere worth pointing out.
 */
export function starterFooter(dirName: string): ProjectFooter {
  return {
    enabled: true,
    icon: "📁",
    title: dirName,
    meta: ["{cwd}"],
    links: [],
    notes: [],
  };
}

export const DEFAULT_PROJECTS_CONFIG: HookyProjectsConfig = {
  version: 1,
  enabled: true,
  default: null,
  projects: {},
};

/** All user-authored text in a footer, for cheap "does it mention X" checks. */
export function footerText(footer: ProjectFooter): string {
  return [
    footer.title,
    ...footer.meta,
    ...footer.notes,
    ...footer.links.flatMap((l) => [l.label, l.url, l.when]),
  ].join("\n");
}

/** True when any link condition needs a port probe or filesystem check. */
export function usesProbes(footer: ProjectFooter): boolean {
  return footer.links.some((l) => l.when.trim() !== "");
}
