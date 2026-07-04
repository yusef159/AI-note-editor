import fs from "fs/promises";
import path from "path";
import { generateId } from "./uuid";

const NOTES_DIR = process.env.NOTES_DATA_DIR
  ? path.resolve(process.env.NOTES_DATA_DIR)
  : path.join(process.cwd(), "data", "notes");
const GROUPS_FILENAME = "groups.json";
const GROUPS_PATH = path.join(NOTES_DIR, GROUPS_FILENAME);

export interface ServerStoredImage {
  mimeType: string;
  data: string;
}

export interface ServerNote {
  id: string;
  title: string;
  groupId: string | null;
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
  groupId: string | null;
  updatedAt: number;
  createdAt: number;
}

export interface ServerNoteGroup {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

const NOTE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidNoteId(id: string): boolean {
  return NOTE_ID_REGEX.test(id);
}

export function isValidNoteGroupId(id: string): boolean {
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

async function readGroups(): Promise<ServerNoteGroup[]> {
  await ensureNotesDir();
  try {
    const raw = await fs.readFile(GROUPS_PATH, "utf-8");
    const groups = JSON.parse(raw) as ServerNoteGroup[];
    if (!Array.isArray(groups)) return [];

    return groups
      .filter(
        (group) =>
          group &&
          isValidNoteGroupId(group.id) &&
          typeof group.name === "string"
      )
      .map((group) => ({
        id: group.id,
        name: group.name,
        updatedAt: Number(group.updatedAt) || Number(group.createdAt) || 0,
        createdAt: Number(group.createdAt) || Number(group.updatedAt) || 0,
      }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeGroups(groups: ServerNoteGroup[]): Promise<void> {
  await ensureNotesDir();
  const tempPath = `${GROUPS_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(groups), "utf-8");
  await fs.rename(tempPath, GROUPS_PATH);
}

function normalizeGroupId(groupId: unknown): string | null {
  return typeof groupId === "string" && isValidNoteGroupId(groupId)
    ? groupId
    : null;
}

export async function listNoteSummaries(): Promise<NoteSummary[]> {
  await ensureNotesDir();
  const files = await fs.readdir(NOTES_DIR);
  const notes: NoteSummary[] = [];

  for (const file of files) {
    if (
      !file.endsWith(".json") ||
      file.endsWith(".tmp") ||
      file === GROUPS_FILENAME
    ) {
      continue;
    }
    try {
      const raw = await fs.readFile(path.join(NOTES_DIR, file), "utf-8");
      const note = JSON.parse(raw) as ServerNote;
      if (!isValidNoteId(note.id) || typeof note.title !== "string") continue;
      notes.push({
        id: note.id,
        title: note.title,
        groupId: normalizeGroupId(note.groupId),
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
    const note = JSON.parse(raw) as ServerNote;
    return {
      ...note,
      groupId: normalizeGroupId(note.groupId),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function createNote(
  title = "Untitled note",
  groupId: string | null = null
): Promise<ServerNote> {
  await ensureNotesDir();
  const now = Date.now();
  const note: ServerNote = {
    id: generateId(),
    title,
    groupId: normalizeGroupId(groupId),
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
    groupId?: string | null;
    content?: ServerNote["content"];
  }
): Promise<ServerNote | null> {
  const existing = await getNote(id);
  if (!existing) return null;

  const updated: ServerNote = {
    ...existing,
    title: updates.title ?? existing.title,
    groupId:
      updates.groupId === undefined
        ? existing.groupId
        : normalizeGroupId(updates.groupId),
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

export async function listNoteGroups(): Promise<ServerNoteGroup[]> {
  const groups = await readGroups();
  return groups.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createNoteGroup(name: string): Promise<ServerNoteGroup> {
  const groups = await readGroups();
  const now = Date.now();
  const group: ServerNoteGroup = {
    id: generateId(),
    name: name.trim() || "Untitled group",
    updatedAt: now,
    createdAt: now,
  };

  await writeGroups([...groups, group]);
  return group;
}

export async function updateNoteGroup(
  id: string,
  name: string
): Promise<ServerNoteGroup | null> {
  const groups = await readGroups();
  const index = groups.findIndex((group) => group.id === id);
  if (index === -1) return null;

  const updated: ServerNoteGroup = {
    ...groups[index],
    name: name.trim() || "Untitled group",
    updatedAt: Date.now(),
  };
  const nextGroups = [...groups];
  nextGroups[index] = updated;

  await writeGroups(nextGroups);
  return updated;
}

export async function deleteNoteGroup(id: string): Promise<boolean> {
  const groups = await readGroups();
  const nextGroups = groups.filter((group) => group.id !== id);
  if (nextGroups.length === groups.length) return false;

  await writeGroups(nextGroups);

  const files = await fs.readdir(NOTES_DIR);
  for (const file of files) {
    if (
      !file.endsWith(".json") ||
      file.endsWith(".tmp") ||
      file === GROUPS_FILENAME
    ) {
      continue;
    }

    try {
      const raw = await fs.readFile(path.join(NOTES_DIR, file), "utf-8");
      const note = JSON.parse(raw) as ServerNote;
      if (note.groupId === id && isValidNoteId(note.id)) {
        await writeNote({ ...note, groupId: null, updatedAt: Date.now() });
      }
    } catch {
      // Skip corrupt files.
    }
  }

  return true;
}
