"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import type { Note, NoteGroup } from "@/lib/types";
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
} from "@/lib/sidebar-preference";

interface NotesSidebarProps {
  notes: Note[];
  groups: NoteGroup[];
  onCreateGroup: () => Promise<NoteGroup | void>;
  onRenameGroup: (id: string, name: string) => void | Promise<void>;
  onDeleteGroup: (id: string) => void;
  onCreateNote: (groupId?: string | null) => void;
  onDeleteNote: (id: string) => void;
  onRenameNote: (id: string, name: string) => void | Promise<void>;
  onMoveNote: (id: string, groupId: string | null) => void;
}

const SIDEBAR_COLLAPSED_EVENT = "sidebar-collapsed-change";

function subscribeToSidebarCollapsed(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
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

function DisclosureIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 transition-transform ${
        collapsed ? "" : "rotate-90"
      }`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.22 14.78a.75.75 0 0 1 0-1.06L10.94 10 7.22 6.28a.75.75 0 0 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function NotesSidebar({
  notes,
  groups,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onCreateNote,
  onDeleteNote,
  onRenameNote,
  onMoveNote,
}: NotesSidebarProps) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsed,
    () => false
  );
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [openMenuNoteId, setOpenMenuNoteId] = useState<string | null>(null);
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  );
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const noteMenuRef = useRef<HTMLDivElement | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }, []);

  useEffect(() => {
    if (!openMenuNoteId && !openGroupMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (openMenuNoteId && !noteMenuRef.current?.contains(target)) {
        setOpenMenuNoteId(null);
      }
      if (openGroupMenuId && !groupMenuRef.current?.contains(target)) {
        setOpenGroupMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openGroupMenuId, openMenuNoteId]);

  const groupIds = new Set(groups.map((group) => group.id));
  const groupedNotes = groups.map((group) => ({
    group,
    notes: notes.filter((note) => note.groupId === group.id),
  }));
  const ungroupedNotes = notes.filter(
    (note) => !note.groupId || !groupIds.has(note.groupId)
  );

  const renderDeleteIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.22 0 .41.1.55.29.14.19.2.43.2.71v.08h-1.5v-.08c0-.28.06-.52.2-.71A.75.75 0 0110 4zM8.75 6.75h.5v8.5h-.5v-8.5zm3 0h.5v8.5h-.5v-8.5z"
        clipRule="evenodd"
      />
    </svg>
  );

  const renderMoreIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
    </svg>
  );

  const renderRenameIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z" />
      <path d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.829-2.828z" />
    </svg>
  );

  const handleCreateGroup = async () => {
    const group = await onCreateGroup();
    if (group) {
      setEditingGroup({ id: group.id, name: group.name });
    }
  };

  const commitGroupName = async () => {
    if (!editingGroup) return;
    const name = editingGroup.name.trim() || "Untitled group";
    await onRenameGroup(editingGroup.id, name);
    setEditingGroup(null);
  };

  const toggleGroupCollapsed = (id: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setEditingGroup(null);
    }
  };

  const commitNoteName = async () => {
    if (!editingNote) return;
    const name = editingNote.title.trim() || "Untitled note";
    await onRenameNote(editingNote.id, name);
    setEditingNote(null);
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setEditingNote(null);
    }
  };

  const handleDropNote = (
    groupId: string | null,
    event: DragEvent<HTMLElement>
  ) => {
    event.preventDefault();
    const noteId = event.dataTransfer.getData("text/plain");
    setDragOverGroupId(null);
    if (noteId) {
      onMoveNote(noteId, groupId);
    }
  };

  const renderNoteItem = (note: Note, nested = false) => {
    const href = `/editor/${note.id}`;
    const isActive = pathname === href;
    const label = note.title || "Untitled note";

    return (
      <li
        key={note.id}
        draggable={!editingNote || editingNote.id !== note.id}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", note.id);
          setOpenMenuNoteId(null);
        }}
        className={`group/note relative flex items-center gap-1 ${
          nested
            ? "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-zinc-300 dark:before:bg-zinc-700"
            : ""
        }`}
      >
        {editingNote?.id === note.id ? (
          <input
            type="text"
            value={editingNote.title}
            onChange={(event) =>
              setEditingNote({ id: note.id, title: event.target.value })
            }
            onBlur={commitNoteName}
            onKeyDown={handleNoteKeyDown}
            className="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none dark:border-indigo-700 dark:bg-zinc-900 dark:text-zinc-100"
            autoFocus
          />
        ) : (
          <Link
            href={href}
            draggable={false}
            className={`min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        )}
        <div
          ref={openMenuNoteId === note.id ? noteMenuRef : undefined}
          className="relative shrink-0"
        >
          <button
            type="button"
            onClick={() =>
              setOpenMenuNoteId((current) =>
                current === note.id ? null : note.id
              )
            }
            className="rounded p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-zinc-200/70 hover:text-zinc-700 group-hover/note:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={`Open actions for ${label}`}
            aria-expanded={openMenuNoteId === note.id}
          >
            {renderMoreIcon()}
          </button>
          {openMenuNoteId === note.id && (
            <div className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex justify-end gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote({ id: note.id, title: label });
                    setOpenMenuNoteId(null);
                  }}
                  className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-label={`Rename ${label}`}
                  title="Rename"
                >
                  {renderRenameIcon()}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuNoteId(null);
                    if (confirm(`Delete "${label}"? This cannot be undone.`)) {
                      onDeleteNote(note.id);
                    }
                  }}
                  className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/30"
                  aria-label={`Delete ${label}`}
                  title="Delete"
                >
                  {renderDeleteIcon()}
                </button>
              </div>
              {groups.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Move to
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveNote(note.id, null);
                      setOpenMenuNoteId(null);
                    }}
                    className="block w-full px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Ungrouped
                  </button>
                  {groups.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      onClick={() => {
                        onMoveNote(note.id, group.id);
                        setOpenMenuNoteId(null);
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {group.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

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
            onClick={() => onCreateNote(null)}
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
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleCreateGroup}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              + New group
            </button>
            <button
              type="button"
              onClick={() => onCreateNote(null)}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 transition-colors"
            >
              + New note
            </button>
          </div>
        )}
      </div>

      <nav
        className={`flex-1 overflow-y-auto pb-4 ${
          collapsed ? "px-1.5 flex flex-col items-center gap-1" : "px-2"
        }`}
      >
        {notes.length === 0 && groups.length === 0 ? (
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
          <div className="space-y-4">
            {groupedNotes.map(({ group, notes: groupNotes }) => (
              <section
                key={group.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverGroupId(group.id);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    setDragOverGroupId(null);
                  }
                }}
                onDrop={(event) => handleDropNote(group.id, event)}
                className={`space-y-1 rounded-lg p-1 transition-colors ${
                  dragOverGroupId === group.id
                    ? "bg-indigo-50 dark:bg-indigo-950/30"
                    : ""
                }`}
              >
                <div className="flex items-center gap-1 px-2">
                  {editingGroup?.id === group.id ? (
                    <input
                      type="text"
                      value={editingGroup.name}
                      onChange={(event) =>
                        setEditingGroup({
                          id: group.id,
                          name: event.target.value,
                        })
                      }
                      onBlur={commitGroupName}
                      onKeyDown={handleGroupKeyDown}
                      className="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 outline-none dark:border-indigo-700 dark:bg-zinc-900 dark:text-zinc-100"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapsed(group.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
                      aria-expanded={!collapsedGroupIds.has(group.id)}
                      title={
                        collapsedGroupIds.has(group.id)
                          ? "Expand group"
                          : "Collapse group"
                      }
                    >
                      <DisclosureIcon collapsed={collapsedGroupIds.has(group.id)} />
                      <span className="min-w-0 flex-1 truncate">{group.name}</span>
                      <span className="shrink-0 text-[10px] text-zinc-400">
                        {groupNotes.length}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onCreateNote(group.id)}
                    className="rounded px-1.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                    aria-label={`New note in ${group.name}`}
                    title="New note in group"
                  >
                    + Note
                  </button>
                  <div
                    ref={openGroupMenuId === group.id ? groupMenuRef : undefined}
                    className="relative shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuNoteId(null);
                        setOpenGroupMenuId((current) =>
                          current === group.id ? null : group.id
                        );
                      }}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      aria-label={`Open actions for ${group.name}`}
                      aria-expanded={openGroupMenuId === group.id}
                      title="Group actions"
                    >
                      {renderMoreIcon()}
                    </button>
                    {openGroupMenuId === group.id && (
                      <div className="absolute right-0 top-7 z-20 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup({
                              id: group.id,
                              name: group.name,
                            });
                            setOpenGroupMenuId(null);
                          }}
                          className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          aria-label={`Rename ${group.name}`}
                          title="Rename"
                        >
                          {renderRenameIcon()}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenGroupMenuId(null);
                            if (
                              confirm(
                                `Delete "${group.name}"? Notes in this group will become ungrouped.`
                              )
                            ) {
                              onDeleteGroup(group.id);
                            }
                          }}
                          className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/30"
                          aria-label={`Delete ${group.name}`}
                          title="Delete"
                        >
                          {renderDeleteIcon()}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {collapsedGroupIds.has(group.id) ? null : groupNotes.length > 0 ? (
                  <ul className="ml-3 space-y-0.5 border-l border-zinc-300 pl-3 dark:border-zinc-700">
                    {groupNotes.map((note) => renderNoteItem(note, true))}
                  </ul>
                ) : (
                  <p className="ml-3 border-l border-zinc-300 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700">
                    Drop notes here
                  </p>
                )}
              </section>
            ))}

            {(ungroupedNotes.length > 0 || groups.length > 0) && (
              <section
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverGroupId("ungrouped");
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    setDragOverGroupId(null);
                  }
                }}
                onDrop={(event) => handleDropNote(null, event)}
                className={`space-y-1 rounded-lg p-1 transition-colors ${
                  dragOverGroupId === "ungrouped"
                    ? "bg-zinc-100 dark:bg-zinc-800/70"
                    : ""
                }`}
              >
                {groups.length > 0 && (
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    Ungrouped
                  </div>
                )}
                {ungroupedNotes.length > 0 ? (
                  <ul className="space-y-0.5">
                    {ungroupedNotes.map((note) => renderNoteItem(note))}
                  </ul>
                ) : (
                  groups.length > 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No notes</p>
                  )
                )}
              </section>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
