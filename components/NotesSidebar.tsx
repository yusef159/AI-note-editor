"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Note } from "@/lib/types";
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
} from "@/lib/sidebar-preference";

interface NotesSidebarProps {
  notes: Note[];
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      {direction === "left" ? (
        <path
          fillRule="evenodd"
          d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      )}
    </svg>
  );
}

export default function NotesSidebar({
  notes,
  onCreateNote,
  onDeleteNote,
}: NotesSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  return (
    <aside
      className={`shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      <div
        className={`border-b border-zinc-200 dark:border-zinc-800 ${
          collapsed ? "p-2 flex justify-center" : "p-4"
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronIcon direction="right" />
          </button>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Lecture Notes
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Paste screenshots to enhance
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="shrink-0 p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronIcon direction="left" />
            </button>
          </div>
        )}
      </div>

      <div className={collapsed ? "p-2 flex justify-center" : "p-3"}>
        {collapsed ? (
          <button
            type="button"
            onClick={onCreateNote}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            aria-label="New note"
            title="New note"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden
            >
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreateNote}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 transition-colors"
          >
            + New note
          </button>
        )}
      </div>

      <nav
        className={`flex-1 overflow-y-auto pb-4 ${
          collapsed ? "px-1.5 flex flex-col items-center gap-1" : "px-2"
        }`}
      >
        {notes.length === 0 ? (
          !collapsed && (
            <p className="text-sm text-zinc-400 px-2 py-4 text-center">
              No notes yet
            </p>
          )
        ) : collapsed ? (
          notes.map((note) => {
            const href = `/editor/${note.id}`;
            const isActive = pathname === href;
            const label = note.title || "Untitled note";
            const initial = label.trim().charAt(0).toUpperCase() || "?";

            return (
              <Link
                key={note.id}
                href={href}
                title={label}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                    : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {initial}
              </Link>
            );
          })
        ) : (
          <ul className="space-y-0.5">
            {notes.map((note) => {
              const href = `/editor/${note.id}`;
              const isActive = pathname === href;
              return (
                <li key={note.id} className="group flex items-center gap-1">
                  <Link
                    href={href}
                    className={`flex-1 truncate rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                        : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {note.title || "Untitled note"}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (
                        confirm(
                          `Delete "${note.title || "Untitled note"}"? This cannot be undone.`
                        )
                      ) {
                        onDeleteNote(note.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    aria-label="Delete note"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.22 0 .41.1.55.29.14.19.2.43.2.71v.08h-1.5v-.08c0-.28.06-.52.2-.71A.75.75 0 0110 4zM8.75 6.75h.5v8.5h-.5v-8.5zm3 0h.5v8.5h-.5v-8.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
