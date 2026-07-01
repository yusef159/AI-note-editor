const imageBlobs = new Map<string, Blob>();

export function registerImageBlob(id: string, blob: Blob): void {
  imageBlobs.set(id, blob);
}

export function getImageBlob(id: string): Blob | undefined {
  return imageBlobs.get(id);
}

export function unregisterImageBlob(id: string): void {
  imageBlobs.delete(id);
}

export function clearImageBlobs(): void {
  imageBlobs.clear();
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${base64}`;
}

export function createImageObjectUrl(
  blob: Blob,
  id: string
): string {
  registerImageBlob(id, blob);
  return URL.createObjectURL(blob);
}
