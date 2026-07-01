"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ENHANCE_SCALE_MAX,
  ENHANCE_SCALE_MIN,
  clampEnhanceScale,
} from "@/lib/enhance-scale-preference";
import {
  type PasteMode,
  type PasteSettings,
  modeUsesEnhancement,
  modeUsesExtract,
  updateEnhanceScale,
  updatePasteMode,
} from "@/lib/paste-settings";

export interface ApiStatus {
  replicateConfigured: boolean;
  geminiConfigured: boolean;
}

const PASTE_MODE_OPTIONS: PasteModeOption[] = [
  {
    mode: "original",
    label: "Original image",
    description: "Paste the screenshot as-is with no processing.",
  },
  {
    mode: "enhanced",
    label: "Enhanced image",
    description: "Upscale and sharpen the screenshot for readability.",
  },
  {
    mode: "text_only",
    label: "Extract text only",
    description: "Convert board content into structured note text.",
  },
  {
    mode: "text_original",
    label: "Extract text + original image",
    description: "Insert structured text, then the original screenshot.",
  },
  {
    mode: "text_enhanced",
    label: "Extract text + enhanced image",
    description: "Insert structured text, then an enhanced screenshot.",
  },
];

interface PasteModeOption {
  mode: PasteMode;
  label: string;
  description: string;
}

function getActiveModeSummary(settings: PasteSettings): string {
  const option = PASTE_MODE_OPTIONS.find((item) => item.mode === settings.mode);
  const label = option?.label ?? "Unknown mode";

  if (modeUsesEnhancement(settings.mode)) {
    return `${label} · ${settings.enhanceScale}×`;
  }

  return label;
}

interface PasteSettingsPanelProps {
  settings: PasteSettings;
  apiStatus: ApiStatus;
  onChange: (settings: PasteSettings) => void;
}

export default function PasteSettingsPanel({
  settings,
  apiStatus,
  onChange,
}: PasteSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [scaleDraft, setScaleDraft] = useState(String(settings.enhanceScale));
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScaleDraft(String(settings.enhanceScale));
  }, [settings.enhanceScale]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const showScale = modeUsesEnhancement(settings.mode);
  const activeModeSummary = getActiveModeSummary(settings);

  const commitScale = () => {
    const next = updateEnhanceScale(Number(scaleDraft));
    onChange(next);
    setScaleDraft(String(next.enhanceScale));
  };

  const handleModeChange = (mode: PasteMode) => {
    onChange(updatePasteMode(mode));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Paste settings"
        onClick={() => setOpen((value) => !value)}
        className={`flex max-w-[14rem] items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors ${
          open
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        <GearIcon />
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-sm">Paste settings</span>
          <span
            className={`block truncate text-xs font-medium ${
              open
                ? "text-indigo-600 dark:text-indigo-300"
                : "text-indigo-600 dark:text-indigo-400"
            }`}
            title={activeModeSummary}
          >
            {activeModeSummary}
          </span>
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Paste settings"
          className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Paste mode
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Choose what happens when you paste or drop a screenshot.
            </p>
          </div>

          <fieldset className="space-y-2">
            {PASTE_MODE_OPTIONS.map((option) => (
              <label
                key={option.mode}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 transition-colors ${
                  settings.mode === option.mode
                    ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="paste-mode"
                  value={option.mode}
                  checked={settings.mode === option.mode}
                  onChange={() => handleModeChange(option.mode)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {showScale && (
            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span>Enhancement scale</span>
              <input
                type="number"
                min={ENHANCE_SCALE_MIN}
                max={ENHANCE_SCALE_MAX}
                step="any"
                value={scaleDraft}
                onChange={(e) => setScaleDraft(e.target.value)}
                onBlur={commitScale}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitScale();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-sm tabular-nums text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                aria-label="Enhancement scale"
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">×</span>
            </label>
          )}

          {settings.mode === "text_enhanced" && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              This mode uses both Gemini text extraction and Replicate enhancement
              per paste (~$0.003–0.004 each).
            </p>
          )}

          {modeUsesExtract(settings.mode) && settings.mode !== "text_enhanced" && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Text extraction uses Gemini 2.5 Flash-Lite (~$0.001 per image).
            </p>
          )}

          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-700">
            <StatusLine
              label="Replicate enhancement"
              configured={apiStatus.replicateConfigured}
              required={modeUsesEnhancement(settings.mode)}
            />
            <StatusLine
              label="Gemini text extraction"
              configured={apiStatus.geminiConfigured}
              required={modeUsesExtract(settings.mode)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusLine({
  label,
  configured,
  required,
}: {
  label: string;
  configured: boolean;
  required: boolean;
}) {
  const statusText = configured ? "configured" : "not configured";
  const statusClass = configured
    ? "text-emerald-600 dark:text-emerald-400"
    : required
      ? "text-amber-600 dark:text-amber-400"
      : "text-zinc-400 dark:text-zinc-500";

  return (
    <p className="flex items-center justify-between gap-3 text-zinc-500 dark:text-zinc-400">
      <span>{label}</span>
      <span className={statusClass}>{statusText}</span>
    </p>
  );
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M8.34 1.804a1 1 0 0 1 .98 0l1.5.857a1 1 0 0 0 1.02 0l1.5-.857a1 1 0 0 1 1.32.417l.75 1.299a1 1 0 0 0 .84.49l1.5.072a1 1 0 0 1 .917 1.183l-.286 1.47a1 1 0 0 0 .23.97l1.07 1.07a1 1 0 0 1 0 1.414l-1.07 1.07a1 1 0 0 0-.23.97l.286 1.47a1 1 0 0 1-.917 1.183l-1.5.072a1 1 0 0 0-.84.49l-.75 1.299a1 1 0 0 1-1.32.417l-1.5-.857a1 1 0 0 0-1.02 0l-1.5.857a1 1 0 0 1-1.32-.417l-.75-1.299a1 1 0 0 0-.84-.49l-1.5-.072a1 1 0 0 1-.917-1.183l.286-1.47a1 1 0 0 0-.23-.97l-1.07-1.07a1 1 0 0 1 0-1.414l1.07-1.07a1 1 0 0 0 .23-.97l-.286-1.47a1 1 0 0 1 .917-1.183l1.5-.072a1 1 0 0 0 .84-.49l.75-1.299a1 1 0 0 1 1.32-.417Zm.66 5.696a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
