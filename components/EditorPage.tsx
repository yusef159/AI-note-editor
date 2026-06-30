"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@/components/Editor";
import NotesSidebar from "@/components/NotesSidebar";
import ExportMenu from "@/components/ExportMenu";
import Toast from "@/components/Toast";
import {
  listNotes,
  getNote,
  createNote,
  saveNote,
  deleteNote,
  loadNoteHtml,
  updateNoteTitle,
} from "@/lib/db";
import type { Note } from "@/lib/types";

interface EditorPageProps {
  noteId: string;
}

export default function EditorPage({ noteId }: EditorPageProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [enhanceStatus, setEnhanceStatus] = useState<
    "idle" | "enhancing" | "error"
  >("idle");
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "warning";
  } | null>(null);
  const [apiConfigured, setApiConfigured] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotes = useCallback(async () => {
    const all = await listNotes();
    setNotes(all);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [all, current] = await Promise.all([
        listNotes(),
        getNote(noteId),
      ]);
      setNotes(all);

      if (!current) {
        router.replace("/");
        return;
      }

      const content = await loadNoteHtml(current);
      setNote(current);
      setTitle(current.title);
      setHtml(content);
      setLoading(false);
    }
    load();
  }, [noteId, router]);

  useEffect(() => {
    fetch("/api/enhance")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => {
        if (!data.configured) setApiConfigured(false);
      })
      .catch(() => setApiConfigured(false));
  }, []);

  const scheduleSave = useCallback(
    (newHtml: string) => {
      setHtml(newHtml);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await saveNote(noteId, title, newHtml);
        await refreshNotes();
      }, 500);
    },
    [noteId, title, refreshNotes]
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      await updateNoteTitle(noteId, value);
      await refreshNotes();
    }, 400);
  };

  const handleCreateNote = async () => {
    const newNote = await createNote();
    await refreshNotes();
    router.push(`/editor/${newNote.id}`);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    const remaining = await listNotes();
    setNotes(remaining);
    if (id === noteId) {
      if (remaining.length > 0) {
        router.push(`/editor/${remaining[0].id}`);
      } else {
        const newNote = await createNote();
        router.push(`/editor/${newNote.id}`);
      }
    }
  };

  const showToast = (message: string, type: "info" | "warning" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-400">
        Loading note…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <NotesSidebar
        notes={notes}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {!apiConfigured && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
            REPLICATE_API_TOKEN is not set — pasted images will be inserted
            without enhancement.
          </div>
        )}

        <header className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 bg-white dark:bg-zinc-900">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 text-xl font-semibold bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            placeholder="Untitled note"
          />
          <div className="flex items-center gap-3 shrink-0">
            {enhanceStatus === "enhancing" && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="enhancing-placeholder-spinner w-3 h-3" />
                Enhancing…
              </span>
            )}
            <ExportMenu title={title} html={html} />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <Editor
            key={note?.id}
            initialContent={html}
            onUpdate={scheduleSave}
            onEnhanceStatus={setEnhanceStatus}
            onToast={showToast}
          />
        </div>
      </main>

      <Toast
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
