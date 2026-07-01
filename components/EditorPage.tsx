"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Editor, { type ProcessingStatus } from "@/components/Editor";
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
import {
  modeUsesEnhancement,
  modeUsesExtract,
  getPasteSettings,
} from "@/lib/paste-settings";
import type { Note } from "@/lib/types";
import type { ApiStatus } from "@/components/PasteSettingsPanel";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] =
    useState<ProcessingStatus>("idle");
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "warning";
  } | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    replicateConfigured: true,
    geminiConfigured: true,
  });
  const [pasteSettings, setPasteSettings] = useState(getPasteSettings);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotes = useCallback(async () => {
    const all = await listNotes();
    setNotes(all);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const all = await listNotes();
        setNotes(all);

        const current = await getNote(noteId);
        if (!current) {
          router.replace("/");
          return;
        }

        const content = await loadNoteHtml(current);
        setNote(current);
        setTitle(current.title);
        setHtml(content);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect to server";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [noteId, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/enhance").then((r) => r.json()),
      fetch("/api/extract").then((r) => r.json()),
    ])
      .then(([enhance, extract]) => {
        setApiStatus({
          replicateConfigured: Boolean(enhance.configured),
          geminiConfigured: Boolean(extract.configured),
        });
      })
      .catch(() => {
        setApiStatus({
          replicateConfigured: false,
          geminiConfigured: false,
        });
      });
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

  const needsReplicate = modeUsesEnhancement(pasteSettings.mode);
  const needsGemini = modeUsesExtract(pasteSettings.mode);
  const showApiBanner =
    (needsReplicate && !apiStatus.replicateConfigured) ||
    (needsGemini && !apiStatus.geminiConfigured);

  let bannerMessage = "";
  if (needsReplicate && !apiStatus.replicateConfigured) {
    bannerMessage =
      "REPLICATE_API_TOKEN is not set — enhanced image modes will fall back to the original image.";
  }
  if (needsGemini && !apiStatus.geminiConfigured) {
    bannerMessage = bannerMessage
      ? `${bannerMessage} GEMINI_API_KEY is not set — text extraction modes will fall back to the original image.`
      : "GEMINI_API_KEY is not set — text extraction modes will fall back to the original image.";
  }

  const processingLabel =
    processingStatus === "enhancing"
      ? "Enhancing…"
      : processingStatus === "extracting"
        ? "Extracting text…"
        : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-400">
        Loading note…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Could not load notes
          </h1>
          <p className="text-sm text-zinc-500">{loadError}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 transition-colors"
          >
            Go to home
          </button>
        </div>
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
        {showApiBanner && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
            {bannerMessage}
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
            {processingLabel && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="enhancing-placeholder-spinner w-3 h-3" />
                {processingLabel}
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
            onProcessingStatus={setProcessingStatus}
            onToast={showToast}
            apiStatus={apiStatus}
            onPasteSettingsChange={setPasteSettings}
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
