import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/utils/cn";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";

const NAV_ITEMS = [
  { href: "/", label: "Sounds", icon: "🔊" },
  { href: "/library", label: "Sound Library", icon: "🎵" },
  { href: "/projects", label: "Project Footers", icon: "📌" },
  { href: "/hooks", label: "Wired Hooks", icon: "🪝" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const router = useRouter();
  const toast = useToast();
  const [opening, setOpening] = React.useState(false);
  const openInEditor = trpc.config.openInVSCode.useMutation();

  const handleOpenSettings = async () => {
    setOpening(true);
    try {
      const result = await openInEditor.mutateAsync();
      toast.addToast(`Opening ${result.path}`, "success", 2000);
    } catch {
      toast.addToast("Couldn't open settings.json. Is `code` on your PATH?", "error");
    } finally {
      setOpening(false);
    }
  };

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border bg-card transition-[width] duration-150",
        collapsed ? "w-11 p-1.5" : "w-40 p-2"
      )}
    >
      <div className={cn("mb-3 flex items-center", collapsed ? "justify-center" : "gap-1")}>
        {!collapsed && <h1 className="flex-1 truncate text-sm font-bold">🪝 Hooky</h1>}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar (⌘\\)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            // The label is the accessible name when collapsed; the icon alone
            // would leave the nav unusable to a screen reader.
            title={item.label}
            aria-label={item.label}
            className={cn(
              "flex items-center rounded text-xs font-medium transition-colors",
              collapsed ? "justify-center px-0 py-1.5" : "gap-1.5 px-2 py-1",
              router.pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-3 border-t border-border pt-2">
        <button
          onClick={handleOpenSettings}
          disabled={opening}
          title="Open settings.json"
          className={cn(
            "w-full rounded bg-secondary text-secondary-foreground transition-colors",
            "hover:bg-secondary/80 disabled:opacity-50",
            collapsed ? "px-0 py-1.5 text-center text-xs" : "px-2 py-1 text-left text-[11px]"
          )}
        >
          {collapsed ? "🔧" : opening ? "Opening…" : "🔧 settings.json"}
        </button>

        {!collapsed && (
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            Sounds in <code className="font-mono">hooky.json</code>, footers in{" "}
            <code className="font-mono">hooky-projects.json</code>. Read at fire time.
          </p>
        )}
      </div>
    </aside>
  );
}
