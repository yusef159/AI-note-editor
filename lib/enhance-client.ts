const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export class EnhanceError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "EnhanceError";
  }
}

export async function enhanceImage(
  blob: Blob,
  scale: number
): Promise<Blob> {
  if (blob.size > MAX_SIZE_BYTES) {
    throw new EnhanceError("Image must be smaller than 10MB");
  }

  if (!navigator.onLine) {
    throw new EnhanceError("You are offline");
  }

  const formData = new FormData();
  formData.append("image", blob, "screenshot.png");
  formData.append("scale", String(scale));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("/api/enhance", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = "Enhancement failed";
      try {
        const json = (await res.json()) as { error?: string };
        message = json.error ?? message;
      } catch {
        message = await res.text().catch(() => message);
      }
      throw new EnhanceError(message, res.status);
    }

    return await res.blob();
  } catch (err) {
    if (err instanceof EnhanceError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new EnhanceError("Enhancement timed out");
    }
    throw new EnhanceError("Enhancement failed");
  } finally {
    clearTimeout(timeout);
  }
}
