"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listNotes, createNote } from "@/lib/db";

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    try {
      setError(null);
      const notes = await listNotes();
      if (notes.length > 0) {
        router.replace(`/editor/${notes[0].id}`);
      } else {
        const note = await createNote();
        router.replace(`/editor/${note.id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to server";
      setError(message);
    }
  }, [router]);

  useEffect(() => {
    init();
  }, [init]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Could not load notes
          </h1>
          <p className="text-sm text-zinc-500">{error}</p>
          <p className="text-xs text-zinc-400">
            Notes are stored on the Raspberry Pi server. If you just updated,
            rebuild the Docker container with{" "}
            <code className="text-zinc-600 dark:text-zinc-300">
              docker compose up -d --build
            </code>
            .
          </p>
          <button
            type="button"
            onClick={init}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center text-zinc-400">
      Loading…
    </div>
  );
}
