import React from "react";

export type Shell = "zsh" | "bash";

/**
 * macOS's real defaults, not a themed prompt.
 *
 * Inventing a powerline/oh-my-zsh prompt would make the mock prettier and less
 * useful: the point of this preview is judging how the footer sits against what
 * you actually see, and a two-line themed prompt would change that judgement.
 */
const PROMPTS: Record<Shell, (dir: string) => string> = {
  zsh: (dir) => `${dir} %`,
  bash: () => "bash-3.2$",
};

interface TerminalPreviewProps {
  /** The footer body exactly as the runner emitted it. */
  content: string;
  shell: Shell;
  /** Directory name shown in the prompt and title bar. */
  dir: string;
  /** Label above the window — which project this is. */
  title?: string;
  /** Dim while a fresh render is in flight, so the stale frame reads as stale. */
  pending?: boolean;
  /** The turn's last line, so the footer has something to sit under. */
  lastLine?: string;
  compact?: boolean;
}

export function TerminalPreview({
  content,
  shell,
  dir,
  title,
  pending,
  lastLine = "Done — 3 files changed.",
  compact,
}: TerminalPreviewProps) {
  const prompt = PROMPTS[shell](dir);

  return (
    <div className={`overflow-hidden rounded-lg border border-black/60 shadow-lg ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 border-b border-black/60 bg-[#2a2a2c] px-2 py-1">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 truncate text-center font-mono text-[10px] text-white/50">
          {title ? `${title} — ` : ""}
          {shell} — {dir}
        </span>
        <span className="w-12" />
      </div>

      {/* A terminal is a terminal in both themes: this deliberately does not
          follow the app's light/dark tokens, because the whole question the
          preview answers is "how does this look in my terminal". */}
      <div
        className={`overflow-x-auto bg-[#0b0b0d] font-mono leading-relaxed text-[#d8d8d8] ${
          compact ? "p-2 text-[10px]" : "p-3 text-[11px]"
        }`}
      >
        <div className="whitespace-pre">
          <span className="text-[#7fd88f]">{prompt}</span>{" "}
          <span className="text-white/70">claude</span>
        </div>
        <div className="whitespace-pre text-white/40">{lastLine}</div>
        {content ? (
          // A real <pre>: this is preformatted terminal output, and the box
          // drawing only lines up because every glyph keeps its column.
          <pre className="m-0 whitespace-pre font-mono text-inherit text-[#d8d8d8]">
            {content.replace(/\n$/, "")}
          </pre>
        ) : (
          <div className="whitespace-pre italic text-white/30">
            (no footer — this directory isn&apos;t registered, and there&apos;s no default)
          </div>
        )}
        <div className="whitespace-pre">
          <span className="text-[#7fd88f]">{prompt}</span>{" "}
          <span className="inline-block h-3 w-[7px] translate-y-[2px] animate-pulse bg-[#d8d8d8]" />
        </div>
      </div>
    </div>
  );
}

interface ShellToggleProps {
  shell: Shell;
  onChange: (shell: Shell) => void;
}

export function ShellToggle({ shell, onChange }: ShellToggleProps) {
  return (
    <span className="inline-flex overflow-hidden rounded border border-border">
      {(["zsh", "bash"] as Shell[]).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={shell === option}
          className={`px-2 py-0.5 font-mono text-[10px] transition-colors ${
            shell === option
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-secondary/50"
          }`}
        >
          {option}
        </button>
      ))}
    </span>
  );
}
