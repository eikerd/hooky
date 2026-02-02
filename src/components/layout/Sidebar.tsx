import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/utils/cn";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";

export function Sidebar() {
  const router = useRouter();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const openVSCodeMutation = trpc.config.openInVSCode.useMutation();

  const isActive = (path: string) => router.pathname === path;

  const handleOpenInVSCode = async () => {
    setOpening(true);
    try {
      await openVSCodeMutation.mutateAsync();
      toast.addToast("Opening settings.json in VSCode...", "success", 2000);
    } catch (error) {
      toast.addToast("Failed to open in VSCode. Is it installed?", "error");
    } finally {
      setOpening(false);
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-card p-6 shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">🪝 Hooky</h1>
        <p className="text-sm text-muted-foreground">The Hooks Manager</p>
      </div>

      <nav className="space-y-2">
        <Link
          href="/"
          className={cn(
            "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive("/")
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          Dashboard
        </Link>
        <Link
          href="/notifications"
          className={cn(
            "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive("/notifications")
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          Notifications
        </Link>
        <Link
          href="/system-sounds"
          className={cn(
            "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive("/system-sounds")
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          System Sounds
        </Link>
      </nav>

      <div className="mt-8 border-t border-border pt-6">
        <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase">
          Actions
        </h3>
        <div className="space-y-2">
          <button
            onClick={handleOpenInVSCode}
            disabled={opening}
            className="w-full rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            title="Open settings.json in VSCode"
          >
            {opening ? "Opening..." : "🔧 Edit Config"}
          </button>
          <button className="w-full rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80">
            Export Config
          </button>
          <button className="w-full rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80">
            Import Config
          </button>
        </div>
      </div>
    </aside>
  );
}
