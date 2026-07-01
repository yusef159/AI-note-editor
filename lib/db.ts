import type { Note, StoredNoteContent } from "./types";
import {
  clearImageBlobs,
  createImageObjectUrl,
  getImageBlob,
} from "./image-blob-registry";
import { generateId } from "./uuid";

const IMAGE_ID_ATTR = "data-image-id";

interface WireImage {
  mimeType: string;
  data: string;
}

interface WireNote {
  id: string;
  title: string;
  content: {
    html: string;
    images: Record<string, WireImage>;
  };
  updatedAt: number;
  createdAt: number;
}

interface NoteSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
}

async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const message = await res
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => res.statusText);
    throw new Error(message || "Request failed");
  }
  return res;
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function blobToBase64(blob: Blob): Promise<WireImage> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    mimeType: blob.type || "application/octet-stream",
    data: btoa(binary),
  };
}

function wireToNote(wire: WireNote): Note {
  const images: Record<string, Blob> = {};
  for (const [id, image] of Object.entries(wire.content.images)) {
    images[id] = base64ToBlob(image.data, image.mimeType);
  }
  return {
    id: wire.id,
    title: wire.title,
    content: { html: wire.content.html, images },
    updatedAt: wire.updatedAt,
    createdAt: wire.createdAt,
  };
}

async function contentToWire(
  content: StoredNoteContent
): Promise<WireNote["content"]> {
  const images: Record<string, WireImage> = {};
  for (const [id, blob] of Object.entries(content.images)) {
    images[id] = await blobToBase64(blob);
  }
  return { html: content.html, images };
}

function summaryToNote(summary: NoteSummary): Note {
  return {
    id: summary.id,
    title: summary.title,
    content: { html: "", images: {} },
    updatedAt: summary.updatedAt,
    createdAt: summary.createdAt,
  };
}

async function blobUrlToBlob(
  url: string,
  imageId?: string | null
): Promise<Blob> {
  if (imageId) {
    const registered = getImageBlob(imageId);
    if (registered) return registered;
  }

  try {
    const res = await fetch(url);
    return res.blob();
  } catch {
    if (imageId) {
      const registered = getImageBlob(imageId);
      if (registered) return registered;
    }
    throw new Error("Could not read image data");
  }
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
      id = generateId();
      img.setAttribute(IMAGE_ID_ATTR, id);
    }

    images[id] = await blobUrlToBlob(src, id);
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
      img.setAttribute("src", createImageObjectUrl(blob, id));
      img.setAttribute(IMAGE_ID_ATTR, id);
    }
  }

  return doc.body.innerHTML;
}

export async function listNotes(): Promise<Note[]> {
  const res = await apiFetch("/api/notes");
  const summaries = (await res.json()) as NoteSummary[];
  return summaries.map(summaryToNote);
}

export async function getNote(id: string): Promise<Note | undefined> {
  try {
    const res = await apiFetch(`/api/notes/${id}`);
    const wire = (await res.json()) as WireNote;
    return wireToNote(wire);
  } catch {
    return undefined;
  }
}

export async function createNote(title = "Untitled note"): Promise<Note> {
  const res = await apiFetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const wire = (await res.json()) as WireNote;
  return wireToNote(wire);
}

export async function saveNote(
  id: string,
  title: string,
  html: string
): Promise<void> {
  const existing = await getNote(id);
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

  const content = await contentToWire({
    html: newContent.html,
    images: prunedImages,
  });

  await apiFetch(`/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
}

export async function loadNoteHtml(note: Note): Promise<string> {
  clearImageBlobs();
  return deserializeNoteContent(note.content);
}

export async function updateNoteTitle(id: string, title: string): Promise<void> {
  await apiFetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
}
