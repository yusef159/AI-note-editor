"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listNotes, createNote } from "@/lib/db";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const notes = await listNotes();
      if (notes.length > 0) {
        router.replace(`/editor/${notes[0].id}`);
      } else {
        const note = await createNote();
        router.replace(`/editor/${note.id}`);
      }
    }
    init();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-zinc-400">
      Loading…
    </div>
  );
}
