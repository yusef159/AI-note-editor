export interface StoredNoteContent {
  html: string;
  images: Record<string, Blob>;
}

export interface Note {
  id: string;
  title: string;
  content: StoredNoteContent;
  updatedAt: number;
  createdAt: number;
}
