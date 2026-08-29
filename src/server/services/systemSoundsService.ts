import { execFile, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import fs from "fs/promises";
import path from "path";
import { SOUND_DIRS, SOUND_EXTENSIONS } from "@/utils/constants";

const execFileAsync = promisify(execFile);

export interface SystemSound {
  name: string;
  path: string;
  /** Seconds. 0 when afinfo couldn't determine it. */
  duration: number;
  /** Which directory it came from, for grouping in the UI. */
  source: "System" | "Local" | "User" | "Custom";
}

const SOURCE_LABELS: Array<SystemSound["source"]> = ["System", "Local", "User", "Custom"];

class SystemSoundsService {
  /** In-process cache: the sound library changes rarely, but the UI polls it. */
  private cache: { at: number; sounds: SystemSound[] } | null = null;
  private static readonly CACHE_MS = 30_000;

  /** The preview currently playing, so a new one can interrupt it. */
  private current: ChildProcess | null = null;

  async list(force = false): Promise<SystemSound[]> {
    if (platform() !== "darwin") return [];

    if (!force && this.cache && Date.now() - this.cache.at < SystemSoundsService.CACHE_MS) {
      return this.cache.sounds;
    }

    const found: SystemSound[] = [];

    for (const [index, dir] of SOUND_DIRS.entries()) {
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue; // Directory doesn't exist; that's normal for the optional ones.
      }

      const audioFiles = entries.filter((file) =>
        SOUND_EXTENSIONS.includes(path.extname(file).toLowerCase())
      );

      // afinfo is one process per file, so fan them out rather than awaiting
      // each in turn -- serially this took ~14 round trips just to draw a list.
      const durations = await Promise.all(
        audioFiles.map((file) => this.duration(path.join(dir, file)))
      );

      audioFiles.forEach((file, i) => {
        found.push({
          name: path.basename(file, path.extname(file)),
          path: path.join(dir, file),
          duration: durations[i],
          source: SOURCE_LABELS[index] ?? "Custom",
        });
      });
    }

    // Earlier directories win on name collision (System before User).
    const seen = new Set<string>();
    const sounds = found
      .filter((sound) => {
        if (seen.has(sound.name)) return false;
        seen.add(sound.name);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    this.cache = { at: Date.now(), sounds };
    return sounds;
  }

  private async duration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync("afinfo", [filePath], { timeout: 5000 });
      const match = stdout.match(/estimated duration:\s+([\d.]+)\s*sec/i);
      return match ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Preview a sound through the same path the hook uses, so what you hear in
   * the UI is exactly what you'll hear at fire time (including volume).
   *
   * execFile, not exec: the path goes straight to argv with no shell, so
   * filenames with spaces or quotes can't break out into a command.
   */
  async play(soundPath: string, volume = 1): Promise<void> {
    if (platform() !== "darwin") {
      throw new Error("Sound preview is macOS-only.");
    }

    const sounds = await this.list();
    const known = sounds.some((sound) => sound.path === soundPath);
    if (!known) {
      // Allow arbitrary files, but confirm they exist and look like audio.
      if (!SOUND_EXTENSIONS.includes(path.extname(soundPath).toLowerCase())) {
        throw new Error("Not a recognized audio file.");
      }
      await fs.access(soundPath);
    }

    // Cancel whatever is still playing. Clicking through the dropdown fires a
    // preview per selection, and without this they stack into overlapping
    // afplay processes instead of letting you audition sounds one at a time.
    this.stopPreview();

    const clamped = Math.max(0, Math.min(2, volume));

    await new Promise<void>((resolve, reject) => {
      const child = spawn("afplay", ["-v", String(clamped), soundPath]);
      this.current = child;

      const done = () => {
        if (this.current === child) this.current = null;
      };

      child.on("error", (error) => {
        done();
        reject(error);
      });
      child.on("close", () => {
        done();
        resolve(); // A killed preview is a normal outcome, not a failure.
      });
    });
  }

  stopPreview(): void {
    if (this.current && !this.current.killed) {
      this.current.kill("SIGTERM");
    }
    this.current = null;
  }
}

export const systemSoundsService = new SystemSoundsService();
