"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import EditorPage from "@/components/EditorPage";

function getNoteId(pathname: string): string | null {
  const [, segment, noteId] = pathname.split("/");
  if (segment !== "editor" || !noteId) return null;
  return decodeURIComponent(noteId);
}

export default function EditorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const noteId = getNoteId(pathname);

  if (!noteId) return <>{children}</>;

  return <EditorPage noteId={noteId} />;
}
