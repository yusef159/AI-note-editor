import sharp from "sharp";

const MAX_PIXELS = 2_000_000;
const EXTRACT_MAX_WIDTH = 1280;

export interface PrepareImageOptions {
  maxWidth?: number;
  jpegQuality?: number;
}

export async function prepareImageBuffer(
  inputBuffer: Buffer,
  options: PrepareImageOptions = {}
): Promise<Buffer> {
  const { maxWidth, jpegQuality = 92 } = options;

  let processed = sharp(inputBuffer).rotate();
  const metadata = await processed.metadata();

  if (metadata.width && metadata.height) {
    const pixels = metadata.width * metadata.height;

    if (maxWidth && metadata.width > maxWidth) {
      processed = processed.resize({
        width: maxWidth,
        fit: "inside",
        withoutEnlargement: true,
      });
    } else if (!maxWidth && pixels > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / pixels);
      processed = processed.resize({
        width: Math.floor(metadata.width * scale),
        height: Math.floor(metadata.height * scale),
        fit: "inside",
        withoutEnlargement: true,
      });
    }
  }

  return processed.jpeg({ quality: jpegQuality }).toBuffer();
}

export async function prepareImageForExtract(
  inputBuffer: Buffer
): Promise<Buffer> {
  return prepareImageBuffer(inputBuffer, {
    maxWidth: EXTRACT_MAX_WIDTH,
    jpegQuality: 85,
  });
}

export async function prepareImageForEnhance(
  inputBuffer: Buffer
): Promise<Buffer> {
  return prepareImageBuffer(inputBuffer);
}
