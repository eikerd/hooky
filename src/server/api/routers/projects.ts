import { z } from "zod";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  displayPath,
  normalizePath,
  projectConfigService,
} from "@/server/services/projectConfigService";
import { legacyImportService } from "@/server/services/legacyImportService";
import { soundConfigService } from "@/server/services/soundConfigService";
import { hookWiringService } from "@/server/services/hookWiringService";
import { runnerService } from "@/server/services/runnerService";
import { projectFooterSchema } from "@/utils/validation";
import { starterFooter } from "@/types/projectFooter";

const pathInput = z.string().min(1);

/** Shape the registry into a stable, display-ready list. */
async function board() {
  const config = await projectConfigService.read();
  const soundConfig = await soundConfigService.read();
  const status = await hookWiringService.status(soundConfig);

  const projects = Object.entries(config.projects)
    .map(([projectPath, footer]) => ({
      projectPath,
      display: displayPath(projectPath),
      footer,
    }))
    .sort((a, b) => a.display.localeCompare(b.display));

  return {
    enabled: config.enabled,
    default: config.default,
    projects,
    status,
  };
}

export const projectsRouter = createTRPCRouter({
  board: publicProcedure.query(board),

  /**
   * Render a footer exactly as it will appear, by piping a synthetic Stop
   * payload through the *installed runner* against a temp copy of the config.
   *
   * Re-implementing the rendering in TypeScript would be faster but would
   * create a second source of truth that drifts -- and the parts most worth
   * previewing (which conditional links survive a `port:` probe) can only be
   * answered by really running it. HOOKY_CONFIG is pointed at a nonexistent
   * path so the preview stays silent: no sound, no banner.
   */
  preview: publicProcedure
    .input(z.object({ projectPath: pathInput, cwd: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (!(await runnerService.isInstalled())) {
        throw new Error("Runner is not installed yet. Click Install on the Sounds page first.");
      }

      const config = await projectConfigService.read();
      const root = normalizePath(input.projectPath);
      const cwd = input.cwd ? normalizePath(input.cwd) : root;

      const tmp = path.join(os.tmpdir(), `hooky-preview-${process.pid}-${Date.now()}.json`);
      // Preview must show this footer even if the feature is globally muted,
      // otherwise the editor goes blank the moment you toggle the master switch.
      await fs.writeFile(tmp, JSON.stringify({ ...config, enabled: true }), "utf-8");

      try {
        const stdout = await new Promise<string>((resolve, reject) => {
          const child = spawn("/bin/bash", [runnerService.scriptPath], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              HOOKY_PROJECTS: tmp,
              HOOKY_CONFIG: path.join(os.tmpdir(), "hooky-preview-no-sounds.json"),
              // A preview is not a real hook. Without this it would append to
              // the trace and light up the live monitor for a Stop that never
              // happened, which is worse than useless -- it is a lie.
              HOOKY_EVENTS: "/dev/null",
            },
          });

          let out = "";
          let err = "";
          child.stdout.on("data", (chunk) => (out += chunk));
          child.stderr.on("data", (chunk) => (err += chunk));
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0 ? resolve(out) : reject(new Error(err.trim() || `exited ${code}`))
          );

          child.stdin.end(
            JSON.stringify({
              hook_event_name: "Stop",
              cwd,
              model: "claude-opus-5",
            })
          );
        });

        const trimmed = stdout.trim();
        if (!trimmed) return { rendered: "", silent: true };

        const parsed = JSON.parse(trimmed) as { systemMessage?: string };
        return { rendered: parsed.systemMessage ?? "", silent: false };
      } finally {
        await fs.rm(tmp, { force: true });
      }
    }),

  add: publicProcedure
    .input(z.object({ projectPath: pathInput }))
    .mutation(async ({ input }) => {
      const abs = normalizePath(input.projectPath);

      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        throw new Error(`No such directory: ${abs}`);
      }
      if (!stat.isDirectory()) throw new Error(`Not a directory: ${abs}`);

      const config = await projectConfigService.read();
      if (config.projects[abs]) throw new Error(`${displayPath(abs)} is already registered.`);

      await projectConfigService.upsert(abs, starterFooter(path.basename(abs)));
      // Registering the first footer is what makes Stop worth wiring, so
      // re-sync rather than waiting for the next sound edit.
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  save: publicProcedure
    .input(z.object({ projectPath: pathInput, footer: projectFooterSchema }))
    .mutation(async ({ input }) => {
      await projectConfigService.upsert(input.projectPath, input.footer);
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  remove: publicProcedure
    .input(z.object({ projectPath: pathInput }))
    .mutation(async ({ input }) => {
      await projectConfigService.remove(input.projectPath);
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  rename: publicProcedure
    .input(z.object({ from: pathInput, to: pathInput }))
    .mutation(async ({ input }) => {
      await projectConfigService.rename(input.from, input.to);
      return board();
    }),

  setGlobalEnabled: publicProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await projectConfigService.setGlobalEnabled(input.enabled);
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  setDefault: publicProcedure
    .input(z.object({ footer: projectFooterSchema.nullable() }))
    .mutation(async ({ input }) => {
      await projectConfigService.setDefault(input.footer);
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  /** Find pre-Hooky .claude/footer.json files worth importing. */
  discover: publicProcedure
    .input(z.object({ roots: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      const roots = input.roots?.length ? input.roots : legacyImportService.defaultRoots();
      const [found, globalDefault, config] = await Promise.all([
        legacyImportService.discover(roots),
        legacyImportService.readGlobalDefault(),
        projectConfigService.read(),
      ]);

      return {
        roots,
        globalDefault,
        found: found.map((entry) => ({
          ...entry,
          // Flagged rather than filtered, so the UI can show "already added"
          // instead of silently dropping a path the user is looking for.
          alreadyRegistered: Boolean(config.projects[normalizePath(entry.projectPath)]),
        })),
      };
    }),

  importFooters: publicProcedure
    .input(
      z.object({
        entries: z.array(z.object({ projectPath: pathInput, footer: projectFooterSchema })),
        globalDefault: projectFooterSchema.nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const config = await projectConfigService.read();
      for (const entry of input.entries) {
        config.projects[normalizePath(entry.projectPath)] = entry.footer;
      }
      if (input.globalDefault !== undefined) config.default = input.globalDefault;

      await projectConfigService.write(config);
      await hookWiringService.sync(await soundConfigService.read());
      return board();
    }),

  /** Directory listing for the "add a project" path picker. */
  listDirs: publicProcedure
    .input(z.object({ dir: z.string().optional() }))
    .query(async ({ input }) => {
      const abs = normalizePath(input.dir?.trim() || os.homedir());

      let entries: string[] = [];
      try {
        entries = (await fs.readdir(abs, { withFileTypes: true }))
          .filter((e) => e.isDirectory() && !e.name.startsWith("."))
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b))
          .slice(0, 300);
      } catch {
        // Unreadable directory: return an empty listing rather than erroring,
        // so typing a partial path in the picker doesn't throw on every keypress.
      }

      return {
        dir: abs,
        display: displayPath(abs),
        parent: abs === "/" ? null : path.dirname(abs),
        entries,
      };
    }),
});
