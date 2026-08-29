import React, { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

const STORAGE_KEY = "hooky.sidebarCollapsed";

export function Layout({ children }: LayoutProps) {
  // Starts expanded on the server and on first paint, then adopts the stored
  // preference. Reading localStorage during render would mismatch the SSR
  // markup and blow up hydration.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode or blocked storage: expanded is a fine default */
    }
  }, []);

  const toggle = () =>
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* preference just won't persist */
      }
      return next;
    });

  // ⌘\ / Ctrl+\ mirrors the editor convention, so the muscle memory is free.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "\\" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] px-3 py-3">{children}</div>
      </main>
    </div>
  );
}
