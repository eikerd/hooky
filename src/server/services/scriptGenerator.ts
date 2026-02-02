import fs from "fs/promises";
import path from "path";
import { NotificationConfig } from "@/types/notifications";
import { CONFIG_PATHS } from "@/utils/constants";

export class ScriptGenerator {
  async parseExistingScript(scriptPath: string): Promise<NotificationConfig[]> {
    try {
      const content = await fs.readFile(scriptPath, "utf-8");
      const notifications: NotificationConfig[] = [];

      // Match switch cases like: "on_error" { $emoji = [char]0x274C; ... }
      const caseRegex =
        /"([^"]+)"\s*\{\s*\$emoji\s*=\s*\[char\]0x([0-9A-F]+);\s*\$message\s*=\s*"([^"]*)\";\s*\$sound\s*=\s*"([^"]*)"/gi;

      let match;
      while ((match = caseRegex.exec(content)) !== null) {
        const hookName = match[1];
        const charCode = parseInt(match[2], 16);
        const emoji = String.fromCharCode(charCode);
        const message = match[3];
        const sound = match[4] as NotificationConfig["sound"];

        notifications.push({
          hookName,
          emoji,
          message,
          sound,
          enabled: true,
        });
      }

      return notifications;
    } catch (error) {
      // Script doesn't exist or can't be parsed, return empty array
      return [];
    }
  }

  generatePowerShellScript(notifications: NotificationConfig[]): string {
    const switchCases = notifications
      .map((notif) => {
        // Encode emoji properly for PowerShell
        const emojiEncoded = this.encodeEmojiForPowerShell(notif.emoji);
        return `  "${notif.hookName}" { $emoji = ${emojiEncoded}; $message = "${notif.message}"; $sound = "${notif.sound}" }`;
      })
      .join("\n");

    return `param(
  [string]$Hook = $env:CLAUDE_HOOK_NAME,
  [string]$Model = $env:CLAUDE_MODEL,
  [string]$File = $env:CLAUDE_FILE,
  [string]$Tokens = $env:CLAUDE_TOKEN_COUNT,
  [string]$Duration = $env:CLAUDE_DURATION_MS
)

Import-Module BurntToast
$title = "Claude Code"
$emoji = ""
$message = ""
$sound = "Default"

switch ($Hook) {
${switchCases}
  Default { $emoji = "ℹ️"; $message = $Hook; $sound = "Default" }
}

$fullMessage = "$emoji $message"
$details = @()
if ($Model) { $details += "Model: $Model" }
if ($File) { $details += "File: $File" }
if ($Tokens) { $details += "Tokens: $Tokens" }
if ($Duration) { $details += "Time: $Duration ms" }
if ($details.Count -gt 0) {
  $fullMessage += \`n + ($details -join " | ")
}

New-BurntToastNotification -Text $title, $fullMessage -Sound $sound
`;
  }

  private encodeEmojiForPowerShell(emoji: string): string {
    // Use simple string approach - PowerShell handles Unicode strings well
    // Try using the emoji directly first
    try {
      // Escape any quotes and use as UTF-16 string
      return `"${emoji.replace(/"/g, '\\"')}"`;
    } catch {
      // Fallback to character code approach for complex emojis
      const codePoint = emoji.codePointAt(0);
      if (codePoint! > 0xffff) {
        // For emojis outside BMP, use .NET encoding
        return `[System.Char]::ConvertFromUtf32(0x${codePoint!.toString(16).toUpperCase()})`;
      }
      return `[char]0x${codePoint!.toString(16).toUpperCase()}`;
    }
  }

  generateBashWrapper(psScriptPath: string): string {
    return `#!/bin/bash
# Claude Code WSL Notification Wrapper
# Converts POSIX environment to PowerShell and executes notification script

# Convert path from WSL to Windows (e.g., /mnt/c/... to C:\\...)
ps_script_path=$(echo "${psScriptPath}" | sed 's|/mnt/\\([a-z]\\)/|\\1:\\\\|g' | sed 's|/|\\\\|g')

# Pass environment variables to PowerShell
pwsh.exe -Command "
  \\$env:CLAUDE_HOOK_NAME = '$CLAUDE_HOOK_NAME'
  \\$env:CLAUDE_MODEL = '$CLAUDE_MODEL'
  \\$env:CLAUDE_FILE = '$CLAUDE_FILE'
  \\$env:CLAUDE_TOKEN_COUNT = '$CLAUDE_TOKEN_COUNT'
  \\$env:CLAUDE_DURATION_MS = '$CLAUDE_DURATION_MS'
  & '$ps_script_path'
" &

exit 0
`;
  }

  async writeScripts(notifications: NotificationConfig[]): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(CONFIG_PATHS.psScript), { recursive: true });

    // Generate and write PowerShell script
    const psContent = this.generatePowerShellScript(notifications);
    await fs.writeFile(CONFIG_PATHS.psScript, psContent, "utf-8");

    // Generate and write bash wrapper
    const bashContent = this.generateBashWrapper(CONFIG_PATHS.psScript);
    await fs.writeFile(CONFIG_PATHS.bashWrapper, bashContent, "utf-8");
    await fs.chmod(CONFIG_PATHS.bashWrapper, 0o755); // Make executable
  }

  async testNotification(hookName: string): Promise<void> {
    // This would execute the script to test the notification
    // For now, this is a placeholder that would be called from the API
    const env = {
      CLAUDE_HOOK_NAME: hookName,
      CLAUDE_MODEL: "test",
      CLAUDE_FILE: "test.ts",
      CLAUDE_TOKEN_COUNT: "1000",
      CLAUDE_DURATION_MS: "500",
    };

    // In a real implementation, this would execute the PowerShell script
    // with the given environment variables
  }
}

export const scriptGenerator = new ScriptGenerator();
