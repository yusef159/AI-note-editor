"use client";

interface ToastProps {
  message: string | null;
  type?: "info" | "warning";
  onDismiss: () => void;
}

export default function Toast({ message, type = "info", onDismiss }: ToastProps) {
  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm max-w-sm animate-in ${
        type === "warning"
          ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800"
          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      }`}
      role="status"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-70 hover:opacity-100 text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
