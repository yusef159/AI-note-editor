import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.REPLICATE_API_TOKEN),
  });
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
// Replicate Real-ESRGAN GPU limit is ~2,096,704 pixels; stay slightly under.
const MAX_PIXELS = 2_000_000;
const MODEL = "nightmareai/real-esrgan";

export async function POST(request: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN is not configured" },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be smaller than 10MB" },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    let processed = sharp(inputBuffer).rotate();
    const metadata = await processed.metadata();

    if (metadata.width && metadata.height) {
      const pixels = metadata.width * metadata.height;
      if (pixels > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / pixels);
        processed = processed.resize({
          width: Math.floor(metadata.width * scale),
          height: Math.floor(metadata.height * scale),
          fit: "inside",
          withoutEnlargement: true,
        });
      }
    }

    const preparedBuffer = await processed.jpeg({ quality: 92 }).toBuffer();
    const dataUri = `data:image/jpeg;base64,${preparedBuffer.toString("base64")}`;

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const output = await replicate.run(MODEL, {
      input: {
        image: dataUri,
        scale: 2,
        face_enhance: false,
      },
    });

    let enhancedBuffer: Buffer;
    if (
      output &&
      typeof output === "object" &&
      "blob" in output &&
      typeof output.blob === "function"
    ) {
      enhancedBuffer = Buffer.from(await (await output.blob()).arrayBuffer());
    } else {
      let outputUrl: string;
      if (typeof output === "string") {
        outputUrl = output;
      } else if (Array.isArray(output) && typeof output[0] === "string") {
        outputUrl = output[0];
      } else {
        return NextResponse.json(
          { error: "Unexpected model output" },
          { status: 500 }
        );
      }

      const enhancedRes = await fetch(outputUrl);
      if (!enhancedRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch enhanced image" },
          { status: 502 }
        );
      }

      enhancedBuffer = Buffer.from(await enhancedRes.arrayBuffer());
    }

    const finalBuffer = await sharp(enhancedBuffer)
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Enhancement error:", err);
    return NextResponse.json(
      { error: "Image enhancement failed" },
      { status: 500 }
    );
  }
}
