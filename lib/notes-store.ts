import fs from "fs/promises";
import path from "path";
import { generateId } from "./uuid";

const NOTES_DIR = process.env.NOTES_DATA_DIR
  ? path.resolve(process.env.NOTES_DATA_DIR)
  : path.join(process.cwd(), "data", "notes");

export interface ServerStoredImage {
  mimeType: string;
  data: string;
}

export interface ServerNote {
  id: string;
  title: string;
  content: {
    html: string;
    images: Record<string, ServerStoredImage>;
  };
  updatedAt: number;
  createdAt: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
}

const NOTE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidNoteId(id: string): boolean {
  return NOTE_ID_REGEX.test(id);
}

async function ensureNotesDir(): Promise<void> {
  await fs.mkdir(NOTES_DIR, { recursive: true });
}

function notePath(id: string): string {
  if (!isValidNoteId(id)) {
    throw new Error("Invalid note id");
  }
  return path.join(NOTES_DIR, `${id}.json`);
}

async function writeNote(note: ServerNote): Promise<void> {
  const filePath = notePath(note.id);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(note), "utf-8");
  await fs.rename(tempPath, filePath);
}

export async function listNoteSummaries(): Promise<NoteSummary[]> {
  await ensureNotesDir();
  const files = await fs.readdir(NOTES_DIR);
  const notes: NoteSummary[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(NOTES_DIR, file), "utf-8");
      const note = JSON.parse(raw) as ServerNote;
      notes.push({
        id: note.id,
        title: note.title,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
      });
    } catch {
      // Skip corrupt files.
    }
  }

  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNote(id: string): Promise<ServerNote | null> {
  try {
    const raw = await fs.readFile(notePath(id), "utf-8");
    return JSON.parse(raw) as ServerNote;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function createNote(title = "Untitled note"): Promise<ServerNote> {
  await ensureNotesDir();
  const now = Date.now();
  const note: ServerNote = {
    id: generateId(),
    title,
    content: { html: "<p></p>", images: {} },
    updatedAt: now,
    createdAt: now,
  };
  await writeNote(note);
  return note;
}

export async function updateNote(
  id: string,
  updates: {
    title?: string;
    content?: ServerNote["content"];
  }
): Promise<ServerNote | null> {
  const existing = await getNote(id);
  if (!existing) return null;

  const updated: ServerNote = {
    ...existing,
    title: updates.title ?? existing.title,
    content: updates.content ?? existing.content,
    updatedAt: Date.now(),
  };

  await writeNote(updated);
  return updated;
}

export async function deleteNote(id: string): Promise<boolean> {
  try {
    await fs.unlink(notePath(id));
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}
