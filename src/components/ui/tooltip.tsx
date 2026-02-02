import React, { useState } from "react";

interface TooltipProps {
  title: string;
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ title, content, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="cursor-help"
      >
        {children}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 bottom-full mb-2 w-80 bg-card border border-border rounded-lg shadow-2xl p-4 text-sm">
          <div className="font-bold text-primary mb-2">{title}</div>
          <div className="text-foreground whitespace-pre-wrap text-xs leading-relaxed">
            {content}
          </div>
          <div className="absolute left-4 top-full w-2 h-2 bg-card border-r border-b border-border transform rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  );
}
