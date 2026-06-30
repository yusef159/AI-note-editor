"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorColor } from "@/lib/editor-colors";

interface EditorColorPickerProps {
  editor: Editor;
  colors: EditorColor[];
  type: "text" | "highlight";
  label: string;
  currentColor: string | null;
}

export default function EditorColorPicker({
  editor,
  colors,
  type,
  label,
  currentColor,
}: EditorColorPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const applyColor = (color: string | null) => {
    if (type === "text") {
      if (color) {
        editor.chain().focus().setColor(color).run();
      } else {
        editor.chain().focus().unsetColor().run();
      }
    } else if (color) {
      editor.chain().focus().setHighlight({ color }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    setOpen(false);
  };

  const indicatorColor =
    currentColor ?? (type === "text" ? "#18181b" : "#fef08a");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className={`flex flex-col items-center rounded-md px-2 py-1 transition-colors ${
          open
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        {type === "text" ? (
          <span className="text-sm font-semibold leading-none">A</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span
          className="mt-0.5 h-1 w-5 rounded-full"
          style={{ backgroundColor: indicatorColor }}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {colors.map((color) => {
              const isSelected =
                color.value === currentColor ||
                (color.value === null && currentColor === null);
              const swatchColor =
                color.value ?? (type === "text" ? "#fafafa" : "transparent");

              return (
                <button
                  key={color.name}
                  type="button"
                  title={color.name}
                  aria-label={color.name}
                  onClick={() => applyColor(color.value)}
                  className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                    isSelected
                      ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900"
                      : "border-zinc-200 dark:border-zinc-600"
                  } ${color.value === null ? "relative overflow-hidden" : ""}`}
                  style={{ backgroundColor: swatchColor }}
                >
                  {color.value === null && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-px w-full rotate-45 bg-red-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
