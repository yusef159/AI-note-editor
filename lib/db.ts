import Dexie, { type Table } from "dexie";
import type { Note, StoredNoteContent } from "./types";

const IMAGE_ID_ATTR = "data-image-id";

class NotesDatabase extends Dexie {
  notes!: Table<Note>;

  constructor() {
    super("LectureNotesDB");
    this.version(1).stores({
      notes: "id, updatedAt, createdAt",
    });
  }
}

export const db = new NotesDatabase();

async function blobUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export async function serializeNoteContent(
  html: string,
  existingImages: Record<string, Blob> = {}
): Promise<StoredNoteContent> {
  const images: Record<string, Blob> = { ...existingImages };
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = doc.querySelectorAll("img[src]");

  for (const img of Array.from(imgs)) {
    const src = img.getAttribute("src");
    if (!src?.startsWith("blob:")) continue;

    let id = img.getAttribute(IMAGE_ID_ATTR);
    if (!id) {
      id = crypto.randomUUID();
      img.setAttribute(IMAGE_ID_ATTR, id);
    }

    images[id] = await blobUrlToBlob(src);
    img.setAttribute("src", `${IMAGE_ID_ATTR}://${id}`);
  }

  return { html: doc.body.innerHTML, images };
}

export async function deserializeNoteContent(
  content: StoredNoteContent
): Promise<string> {
  const doc = new DOMParser().parseFromString(content.html, "text/html");
  const imgs = doc.querySelectorAll(`img[src^="${IMAGE_ID_ATTR}://"]`);

  for (const img of Array.from(imgs)) {
    const src = img.getAttribute("src")!;
    const id = src.replace(`${IMAGE_ID_ATTR}://`, "");
    const blob = content.images[id];
    if (blob) {
      const url = URL.createObjectURL(blob);
      img.setAttribute("src", url);
      img.setAttribute(IMAGE_ID_ATTR, id);
    }
  }

  return doc.body.innerHTML;
}

export async function listNotes(): Promise<Note[]> {
  return db.notes.orderBy("updatedAt").reverse().toArray();
}

export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function createNote(title = "Untitled note"): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(),
    title,
    content: { html: "<p></p>", images: {} },
    updatedAt: now,
    createdAt: now,
  };
  await db.notes.add(note);
  return note;
}

export async function saveNote(
  id: string,
  title: string,
  html: string
): Promise<void> {
  const existing = await db.notes.get(id);
  if (!existing) return;

  const newContent = await serializeNoteContent(
    html,
    existing.content.images
  );

  const usedIds = new Set<string>();
  for (const match of newContent.html.matchAll(
    /data-image-id="([a-f0-9-]+)"/g
  )) {
    usedIds.add(match[1]);
  }
  for (const match of newContent.html.matchAll(
    /data-image-id:\/\/([a-f0-9-]+)/g
  )) {
    usedIds.add(match[1]);
  }

  const prunedImages: Record<string, Blob> = {};
  for (const [key, blob] of Object.entries(newContent.images)) {
    if (usedIds.has(key)) prunedImages[key] = blob;
  }

  await db.notes.update(id, {
    title,
    content: { html: newContent.html, images: prunedImages },
    updatedAt: Date.now(),
  });
}

export async function loadNoteHtml(note: Note): Promise<string> {
  return deserializeNoteContent(note.content);
}

export async function updateNoteTitle(id: string, title: string): Promise<void> {
  await db.notes.update(id, { title, updatedAt: Date.now() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}
