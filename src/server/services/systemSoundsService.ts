import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { existsSync } from "fs";

const execAsync = promisify(exec);

export interface SystemSound {
  name: string;
  path: string;
  durationMicroseconds: number;
}

class SystemSoundsService {
  async listSystemSounds(): Promise<SystemSound[]> {
    const currentPlatform = platform();

    if (currentPlatform === "darwin") {
      return this.listMacOSSounds();
    } else if (currentPlatform === "win32") {
      return this.listWindowsSounds();
    }

    return [];
  }

  private async listMacOSSounds(): Promise<SystemSound[]> {
    try {
      const soundDirs = [
        "/System/Library/Sounds",
        "/Library/Sounds",
        `${process.env.HOME}/Library/Sounds`,
      ];

      const allSounds: SystemSound[] = [];

      for (const dir of soundDirs) {
        try {
          const { stdout } = await execAsync(`find "${dir}" -name "*.aiff" -o -name "*.wav" -o -name "*.m4a" 2>/dev/null`);
          const files = stdout.trim().split("\n").filter(f => f);

          for (const file of files) {
            if (!file) continue;

            try {
              // Get duration using afinfo (macOS)
              const { stdout: afinfo } = await execAsync(`afinfo "${file}" 2>/dev/null | grep "duration:"`, {
                shell: "/bin/bash",
              });

              const durationMatch = afinfo.match(/duration:\s+([\d.]+)\s+sec/);
              const durationSeconds = durationMatch ? parseFloat(durationMatch[1]) : 0;
              const durationMicroseconds = Math.round(durationSeconds * 1_000_000);

              const name = file.split("/").pop()?.replace(/\.(aiff|wav|m4a)$/i, "") || "";

              if (name && durationMicroseconds > 0) {
                allSounds.push({
                  name,
                  path: file,
                  durationMicroseconds,
                });
              }
            } catch (err) {
              continue;
            }
          }
        } catch (err) {
          continue;
        }
      }

      // Remove duplicates by name
      const seen = new Set<string>();
      const unique = allSounds.filter(sound => {
        if (seen.has(sound.name)) return false;
        seen.add(sound.name);
        return true;
      });

      return unique.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error listing macOS sounds:", error);
      return [];
    }
  }

  private async listWindowsSounds(): Promise<SystemSound[]> {
    try {
      const soundDirs = [
        "C:\\Windows\\Media",
        "C:\\Windows\\Media\\tada",
      ];

      const allSounds: SystemSound[] = [];

      for (const dir of soundDirs) {
        try {
          // Use PowerShell to list sound files
          const { stdout } = await execAsync(
            `powershell -NoProfile -Command "Get-ChildItem -Path '${dir}' -Include *.wav,*.mp3 -ErrorAction SilentlyContinue | ForEach-Object { Write-Output $_.FullName }"`,
            { shell: "powershell.exe" }
          );

          const files = stdout.trim().split("\n").filter(f => f && f.trim());

          for (const file of files) {
            if (!file || !file.trim()) continue;

            try {
              // For Windows, try to get duration using a PowerShell method
              const fileName = file.split("\\").pop()?.replace(/\.(wav|mp3)$/i, "") || "";

              // Estimate duration for Windows - we'll use file properties
              // For now, use a default estimate
              const durationMicroseconds = 2_000_000; // Default 2 seconds for demo

              if (fileName) {
                allSounds.push({
                  name: fileName,
                  path: file.trim(),
                  durationMicroseconds,
                });
              }
            } catch (err) {
              continue;
            }
          }
        } catch (err) {
          continue;
        }
      }

      // Remove duplicates by name
      const seen = new Set<string>();
      const unique = allSounds.filter(sound => {
        if (seen.has(sound.name)) return false;
        seen.add(sound.name);
        return true;
      });

      return unique.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error listing Windows sounds:", error);
      return [];
    }
  }

  async playSystemSound(soundPath: string): Promise<void> {
    const currentPlatform = platform();

    try {
      if (currentPlatform === "darwin") {
        await execAsync(`afplay "${soundPath}"`);
      } else if (currentPlatform === "win32") {
        // Use PowerShell to play sound on Windows
        const escapedPath = soundPath.replace(/"/g, '\\"');
        await execAsync(
          `powershell -NoProfile -Command "[System.Media.SoundPlayer]::new(\\'${soundPath}\\').PlaySync()"`,
          { shell: "powershell.exe" }
        );
      } else {
        throw new Error("System sounds are not supported on this platform");
      }
    } catch (error) {
      console.error("Error playing sound:", error);
      throw new Error("Failed to play system sound");
    }
  }

  formatDuration(microseconds: number): string {
    const seconds = microseconds / 1_000_000;
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}:${parseInt(secs).toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  }
}

export const systemSoundsService = new SystemSoundsService();
