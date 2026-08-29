import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TerminalPreview, ShellToggle, Shell } from "@/components/projects/TerminalPreview";
import {
  FOOTER_CONDITIONS,
  FOOTER_TOKENS,
  FooterLink,
  ProjectFooter,
} from "@/types/projectFooter";

const QUICK_ICONS = ["📁", "🩺", "🎛️", "🏠", "🧪", "🌐", "⚙️", "📊", "🎮", "🤖", "🔌", "🗄️"];

interface FooterEditorProps {
  footer: ProjectFooter;
  onChange: (patch: Partial<ProjectFooter>) => void;
  /** Rendered output from the real runner; null while it hasn't run yet. */
  preview: string | null;
  previewPending: boolean;
  previewError: string | null;
  onPreview: () => void;
  /** Absolute project path; only its basename is shown, in the mock prompt. */
  projectPath: string;
}

export function FooterEditor({
  footer,
  onChange,
  preview,
  previewPending,
  previewError,
  onPreview,
  projectPath,
}: FooterEditorProps) {
  // Which text input last had focus, so a token click lands where the user was
  // typing rather than always appending to the title.
  const [target, setTarget] = useState<{ kind: "meta" | "note" | "title"; index: number }>({
    kind: "title",
    index: 0,
  });

  const insertToken = (token: string) => {
    if (target.kind === "title") {
      onChange({ title: footer.title + token });
    } else if (target.kind === "meta") {
      const meta = [...footer.meta];
      meta[target.index] = (meta[target.index] ?? "") + token;
      onChange({ meta });
    } else {
      const notes = [...footer.notes];
      notes[target.index] = (notes[target.index] ?? "") + token;
      onChange({ notes });
    }
  };

  const patchLink = (index: number, patch: Partial<FooterLink>) => {
    const links = [...footer.links];
    links[index] = { ...links[index]!, ...patch };
    onChange({ links });
  };

  return (
    <div className="space-y-5 border-t border-border px-4 py-5">
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon</label>
          <input
            value={footer.icon}
            onChange={(e) => onChange({ icon: e.target.value })}
            placeholder="—"
            className="h-9 w-16 rounded-md border border-border bg-input px-2 text-center text-lg"
          />
          <div className="mt-1.5 flex w-56 flex-wrap gap-1">
            {QUICK_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => onChange({ icon })}
                className="h-7 w-7 rounded transition-colors hover:bg-secondary"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label>
          <input
            value={footer.title}
            onFocus={() => setTarget({ kind: "title", index: 0 })}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Falls back to the directory name"
            className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
          />
        </div>
      </div>

      <StringList
        label="Status lines"
        hint="Rendered above the links. Tokens resolve when the footer is drawn."
        values={footer.meta}
        placeholder="{cwd}"
        onFocusIndex={(index) => setTarget({ kind: "meta", index })}
        onChange={(meta) => onChange({ meta })}
      />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-xs font-medium text-muted-foreground">Links</label>
          <span className="text-[11px] text-muted-foreground">
            A condition hides the row unless it holds
          </span>
        </div>

        <div className="space-y-2">
          {footer.links.map((link, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input
                value={link.label}
                onChange={(e) => patchLink(index, { label: e.target.value })}
                placeholder="Label"
                className="h-9 w-40 rounded-md border border-border bg-input px-3 text-sm"
              />
              <input
                value={link.url}
                onChange={(e) => patchLink(index, { url: e.target.value })}
                placeholder="https://…"
                className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-input px-3 font-mono text-xs"
              />
              <input
                value={link.when}
                onChange={(e) => patchLink(index, { when: e.target.value })}
                placeholder="always"
                list="footer-conditions"
                title="Condition — prefix with ! to negate"
                className="h-9 w-40 rounded-md border border-border bg-input px-3 font-mono text-xs"
              />
              <button
                onClick={() => onChange({ links: footer.links.filter((_, i) => i !== index) })}
                className="h-9 w-9 rounded-md border border-border text-muted-foreground
                  transition-colors hover:bg-destructive/20 hover:text-red-300"
                title="Remove link"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <datalist id="footer-conditions">
          {FOOTER_CONDITIONS.filter((c) => c.value).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </datalist>

        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => onChange({ links: [...footer.links, { label: "", url: "", when: "" }] })}
        >
          + Add link
        </Button>

        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
            Condition reference
          </summary>
          <ul className="mt-1.5 space-y-1 pl-1 text-[11px] text-muted-foreground">
            {FOOTER_CONDITIONS.map((c) => (
              <li key={c.label}>
                <code className="font-mono text-foreground">{c.value || "(empty)"}</code> — {c.label}
              </li>
            ))}
            <li>
              Prefix any condition with <code className="font-mono text-foreground">!</code> to
              invert it. An unrecognized condition shows the link rather than hiding it.
            </li>
          </ul>
        </details>
      </div>

      <StringList
        label="Notes"
        hint="Static lines below the links."
        values={footer.notes}
        placeholder="npm run dev → http://localhost:5273"
        onFocusIndex={(index) => setTarget({ kind: "note", index })}
        onChange={(notes) => onChange({ notes })}
      />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Tokens — click to insert into the last field you edited
        </label>
        <div className="flex flex-wrap gap-1">
          {FOOTER_TOKENS.map((token) => (
            <button
              key={token.token}
              onClick={() => insertToken(token.token)}
              title={token.describe}
              className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]
                text-secondary-foreground transition-colors hover:bg-muted"
            >
              {token.token}
            </button>
          ))}
        </div>
      </div>

      <FooterPreview
        preview={preview}
        pending={previewPending}
        error={previewError}
        onPreview={onPreview}
        dir={projectPath.split("/").filter(Boolean).pop() || "~"}
      />
    </div>
  );
}

interface StringListProps {
  label: string;
  hint: string;
  values: string[];
  placeholder: string;
  onFocusIndex: (index: number) => void;
  onChange: (values: string[]) => void;
}

function StringList({ label, hint, values, placeholder, onFocusIndex, onChange }: StringListProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>

      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              onFocus={() => onFocusIndex(index)}
              onChange={(e) => {
                const next = [...values];
                next[index] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="h-9 flex-1 rounded-md border border-border bg-input px-3 font-mono text-xs"
            />
            <button
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="h-9 w-9 rounded-md border border-border text-muted-foreground
                transition-colors hover:bg-destructive/20 hover:text-red-300"
              title={`Remove from ${label.toLowerCase()}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange([...values, ""])}>
        + Add line
      </Button>
    </div>
  );
}

interface FooterPreviewProps {
  preview: string | null;
  pending: boolean;
  error: string | null;
  onPreview: () => void;
  /** Directory name for the mock prompt — makes {dir}/{project} tokens legible. */
  dir: string;
}

/**
 * The preview is produced by really executing the installed runner, so what
 * shows here is what Claude Code will print -- including which conditional
 * links survived their port/file probes.
 */
function FooterPreview({ preview, pending, error, onPreview, dir }: FooterPreviewProps) {
  const [shell, setShell] = useState<Shell>("zsh");
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (preview !== null) previous.current = preview;
  }, [preview]);

  const shown = preview ?? previous.current;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={onPreview} disabled={pending}>
          {pending ? "Rendering…" : "👁 Preview footer"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Runs the installed hook script against your unsaved edits.
        </span>
        <span className="ml-auto">
          <ShellToggle shell={shell} onChange={setShell} />
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {!error && shown !== null && (
        <TerminalPreview content={shown} shell={shell} dir={dir} pending={pending} />
      )}
    </div>
  );
}
