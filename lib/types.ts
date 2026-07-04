export interface StoredNoteContent {
  html: string;
  images: Record<string, Blob>;
}

export interface Note {
  id: string;
  title: string;
  groupId: string | null;
  content: StoredNoteContent;
  updatedAt: number;
  createdAt: number;
}

export interface NoteGroup {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}
