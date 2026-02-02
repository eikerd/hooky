import React, { useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType, duration: number = 3000) => {
      const id = Date.now().toString();
      const newToast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: Toast;
  onClose: () => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const bgColor = {
    success: "bg-green-900 border-green-700",
    error: "bg-red-900 border-red-700",
    info: "bg-blue-900 border-blue-700",
    warning: "bg-yellow-900 border-yellow-700",
  }[toast.type];

  const icon = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warning: "⚠️",
  }[toast.type];

  return (
    <div
      className={`${bgColor} border rounded-lg px-4 py-3 text-white shadow-lg pointer-events-auto flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300`}
      role="alert"
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        className="text-white/60 hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
