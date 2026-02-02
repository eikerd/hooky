import fs from "fs/promises";
import path from "path";
import { ClaudeSettings } from "@/types/hooks";
import { validateSettings } from "@/utils/validation";
import { CONFIG_PATHS } from "@/utils/constants";

export class ConfigService {
  async readSettings(): Promise<ClaudeSettings> {
    try {
      const content = await fs.readFile(CONFIG_PATHS.settings, "utf-8");
      const data = JSON.parse(content);
      return validateSettings(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, return empty settings
        return {};
      }
      throw error;
    }
  }

  async writeSettings(settings: ClaudeSettings): Promise<void> {
    const validated = validateSettings(settings);

    // Ensure directory exists
    await fs.mkdir(path.dirname(CONFIG_PATHS.settings), { recursive: true });

    // Create backup before writing
    try {
      const existing = await fs.readFile(CONFIG_PATHS.settings, "utf-8");
      await fs.writeFile(CONFIG_PATHS.settingsBackup, existing, "utf-8");
    } catch {
      // Backup doesn't exist, that's fine
    }

    // Atomic write: write to temp file, then rename
    const tmpPath = CONFIG_PATHS.settings + ".tmp";
    const content = JSON.stringify(validated, null, 2);

    await fs.writeFile(tmpPath, content, "utf-8");

    // Atomic rename
    await fs.rename(tmpPath, CONFIG_PATHS.settings);
  }

  async backupSettings(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = CONFIG_PATHS.settings + `.backup-${timestamp}`;

    try {
      const content = await fs.readFile(CONFIG_PATHS.settings, "utf-8");
      await fs.writeFile(backupPath, content, "utf-8");
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to backup settings: ${error}`);
    }
  }

  async exportSettings(): Promise<string> {
    const settings = await this.readSettings();
    return JSON.stringify(settings, null, 2);
  }

  async importSettings(content: string): Promise<void> {
    const data = JSON.parse(content);
    const validated = validateSettings(data);
    await this.writeSettings(validated);
  }
}

export const configService = new ConfigService();
