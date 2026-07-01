import type { ExtractResult } from "@/lib/extract-blocks-to-html";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export class ExtractError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ExtractError";
  }
}

export async function extractImage(blob: Blob): Promise<ExtractResult> {
  if (blob.size > MAX_SIZE_BYTES) {
    throw new ExtractError("Image must be smaller than 10MB");
  }

  if (!navigator.onLine) {
    throw new ExtractError("You are offline");
  }

  const formData = new FormData();
  formData.append("image", blob, "screenshot.png");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = "Text extraction failed";
      try {
        const json = (await res.json()) as { error?: string };
        message = json.error ?? message;
      } catch {
        message = await res.text().catch(() => message);
      }
      throw new ExtractError(message, res.status);
    }

    return (await res.json()) as ExtractResult;
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ExtractError("Text extraction timed out");
    }
    throw new ExtractError("Text extraction failed");
  } finally {
    clearTimeout(timeout);
  }
}
