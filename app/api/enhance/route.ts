import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp";
import { prepareImageForEnhance } from "@/lib/prepare-image-buffer";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.REPLICATE_API_TOKEN),
  });
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MODEL = "nightmareai/real-esrgan";
const SCALE_MIN = 0;
const SCALE_MAX = 10;
const SCALE_DEFAULT = 2;

function parseScale(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return SCALE_DEFAULT;
  if (typeof raw !== "string") return null;

  const scale = Number(raw);
  if (!Number.isFinite(scale) || scale < SCALE_MIN || scale > SCALE_MAX) {
    return null;
  }

  return scale;
}

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
    const scale = parseScale(formData.get("scale"));

    if (scale === null) {
      return NextResponse.json(
        { error: `Scale must be a number between ${SCALE_MIN} and ${SCALE_MAX}` },
        { status: 400 }
      );
    }

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
    const preparedBuffer = await prepareImageForEnhance(inputBuffer);
    const dataUri = `data:image/jpeg;base64,${preparedBuffer.toString("base64")}`;

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const output = await replicate.run(MODEL, {
      input: {
        image: dataUri,
        scale,
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
