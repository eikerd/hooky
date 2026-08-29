import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  DEFAULT_PROJECTS_CONFIG,
  FooterLink,
  HookyProjectsConfig,
  ProjectFooter,
  emptyFooter,
} from "@/types/projectFooter";
import { CONFIG_PATHS } from "@/utils/constants";

const home = os.homedir();

/** Absolute, trailing slash stripped. Registry keys are always in this form. */
export function normalizePath(input: string): string {
  let p = input.trim();
  if (p === "~") p = home;
  else if (p.startsWith("~/")) p = path.join(home, p.slice(2));
  p = path.resolve(p);
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** Inverse of normalizePath, for display only. Never written to disk. */
export function displayPath(abs: string): string {
  return abs === home || abs.startsWith(`${home}/`) ? `~${abs.slice(home.length)}` : abs;
}

/**
 * Owns ~/.claude/hooky-projects.json.
 *
 * Reads are forgiving in exactly the same way soundConfigService is: a
 * truncated or hand-edited file still yields a usable config rather than
 * throwing, because the runner reads this same file on Claude Code's critical
 * path and the UI must never disagree with it about what a half-written config
 * means.
 */
export class ProjectConfigService {
  async read(): Promise<HookyProjectsConfig> {
    try {
      const raw = await fs.readFile(CONFIG_PATHS.projectConfig, "utf-8");
      return this.coerce(JSON.parse(raw));
    } catch {
      return structuredClone(DEFAULT_PROJECTS_CONFIG);
    }
  }

  /** Force every field into shape, dropping anything unrecognizable. */
  private coerce(partial: unknown): HookyProjectsConfig {
    const base = structuredClone(DEFAULT_PROJECTS_CONFIG);
    if (!partial || typeof partial !== "object") return base;

    const input = partial as Partial<HookyProjectsConfig>;
    if (typeof input.enabled === "boolean") base.enabled = input.enabled;
    if (input.default) base.default = this.coerceFooter(input.default);

    if (input.projects && typeof input.projects === "object") {
      for (const [key, value] of Object.entries(input.projects)) {
        if (!key.trim()) continue;
        // Keys may be hand-written with ~; store them expanded so the runner's
        // prefix match compares like with like.
        base.projects[normalizePath(key)] = this.coerceFooter(value);
      }
    }
    return base;
  }

  private coerceFooter(value: unknown): ProjectFooter {
    const base = emptyFooter();
    if (!value || typeof value !== "object") return base;
    const input = value as Partial<ProjectFooter>;

    if (typeof input.enabled === "boolean") base.enabled = input.enabled;
    if (typeof input.icon === "string") base.icon = input.icon;
    if (typeof input.title === "string") base.title = input.title;
    base.meta = this.strings(input.meta);
    base.notes = this.strings(input.notes);

    if (Array.isArray(input.links)) {
      base.links = input.links
        .filter((l): l is FooterLink => !!l && typeof l === "object")
        .map((l) => ({
          label: typeof l.label === "string" ? l.label : "",
          url: typeof l.url === "string" ? l.url : "",
          when: typeof l.when === "string" ? l.when : "",
        }));
    }
    return base;
  }

  private strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  }

  async write(config: HookyProjectsConfig): Promise<void> {
    await fs.mkdir(path.dirname(CONFIG_PATHS.projectConfig), { recursive: true });

    // Atomic, so the runner never reads a half-flushed file mid-turn.
    const tmp = `${CONFIG_PATHS.projectConfig}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(config, null, 2), "utf-8");
    await fs.rename(tmp, CONFIG_PATHS.projectConfig);
  }

  async upsert(projectPath: string, footer: ProjectFooter): Promise<HookyProjectsConfig> {
    const config = await this.read();
    config.projects[normalizePath(projectPath)] = this.coerceFooter(footer);
    await this.write(config);
    return config;
  }

  async remove(projectPath: string): Promise<HookyProjectsConfig> {
    const config = await this.read();
    delete config.projects[normalizePath(projectPath)];
    await this.write(config);
    return config;
  }

  /** Move an entry when the user edits a project's path. */
  async rename(from: string, to: string): Promise<HookyProjectsConfig> {
    const config = await this.read();
    const oldKey = normalizePath(from);
    const newKey = normalizePath(to);
    if (oldKey !== newKey && config.projects[oldKey]) {
      config.projects[newKey] = config.projects[oldKey]!;
      delete config.projects[oldKey];
      await this.write(config);
    }
    return config;
  }

  async setGlobalEnabled(enabled: boolean): Promise<HookyProjectsConfig> {
    const config = await this.read();
    config.enabled = enabled;
    await this.write(config);
    return config;
  }

  async setDefault(footer: ProjectFooter | null): Promise<HookyProjectsConfig> {
    const config = await this.read();
    config.default = footer ? this.coerceFooter(footer) : null;
    await this.write(config);
    return config;
  }

  /**
   * Resolve which entry a given cwd would use, by longest matching prefix.
   * Mirrors the runner's lookup so the UI preview can't disagree with it.
   */
  resolve(
    config: HookyProjectsConfig,
    cwd: string
  ): { root: string; footer: ProjectFooter; isDefault: boolean } | null {
    if (!config.enabled) return null;
    const target = normalizePath(cwd);

    let bestKey: string | null = null;
    for (const key of Object.keys(config.projects)) {
      if (target === key || target.startsWith(`${key}/`)) {
        if (bestKey === null || key.length > bestKey.length) bestKey = key;
      }
    }

    if (bestKey !== null) {
      const footer = config.projects[bestKey]!;
      return footer.enabled ? { root: bestKey, footer, isDefault: false } : null;
    }
    if (config.default?.enabled) {
      return { root: target, footer: config.default, isDefault: true };
    }
    return null;
  }

  /** True when at least one footer could actually render. */
  hasActiveFooter(config: HookyProjectsConfig): boolean {
    if (!config.enabled) return false;
    if (config.default?.enabled) return true;
    return Object.values(config.projects).some((f) => f.enabled);
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(CONFIG_PATHS.projectConfig);
      return true;
    } catch {
      return false;
    }
  }
}

export const projectConfigService = new ProjectConfigService();
