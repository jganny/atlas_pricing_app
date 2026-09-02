"use client";

import { create } from "zustand";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = "info") {
  useToastStore.getState().push(message, tone);
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[110] flex max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg",
            t.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
            t.tone === "error" && "border-red-200 bg-red-50 text-red-900",
            t.tone === "info" && "border-sky-200 bg-sky-50 text-sky-900",
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X className="h-4 w-4 opacity-60" />
          </button>
        </div>
      ))}
    </div>
  );
}
