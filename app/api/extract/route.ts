import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import type { ExtractBlock, ExtractResult } from "@/lib/extract-blocks-to-html";
import { prepareImageForExtract } from "@/lib/prepare-image-buffer";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MODEL = "gemini-2.5-flash-lite";

const EXTRACT_PROMPT = `You are transcribing a lecture board or classroom screenshot into structured study notes.

Rules:
- Transcribe all visible text faithfully. Do not invent or guess missing content.
- Preserve math and formulas as LaTeX.
- Wrap inline math in single dollar signs, e.g. $\\int x dx$.
- Wrap display equations in double dollar signs, e.g. $$\\frac{a}{b}$$.
- Detect structure: headings, paragraphs, questions, answers, and bullet lists.
- Use "question" for explicit questions; use "answer" for answers or solutions.
- Use "heading" with level 2 for main topics and level 3 for subtopics.
- Use "bullet" for list items.
- If content is unclear, omit it rather than guessing.
- Return only content visible in the image.`;

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["heading", "paragraph", "question", "answer", "bullet"],
          },
          level: {
            type: SchemaType.INTEGER,
            nullable: true,
          },
          text: { type: SchemaType.STRING },
        },
        required: ["type", "text"],
      },
    },
  },
  required: ["blocks"],
};

function isValidBlock(value: unknown): value is ExtractBlock {
  if (!value || typeof value !== "object") return false;

  const block = value as { type?: string; text?: string; level?: number };
  if (typeof block.text !== "string" || !block.text.trim()) return false;

  switch (block.type) {
    case "heading":
      return block.level === 2 || block.level === 3;
    case "paragraph":
    case "question":
    case "answer":
    case "bullet":
      return true;
    default:
      return false;
  }
}

function normalizeBlocks(raw: unknown): ExtractBlock[] {
  if (!raw || typeof raw !== "object") return [];

  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];

  return blocks.filter(isValidBlock).map((block) => {
    if (block.type === "heading") {
      return {
        type: "heading",
        level: block.level === 3 ? 3 : 2,
        text: block.text.trim(),
      };
    }

    return {
      type: block.type,
      text: block.text.trim(),
    } as ExtractBlock;
  });
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
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
    const preparedBuffer = await prepareImageForExtract(inputBuffer);
    const base64 = preparedBuffer.toString("base64");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const result = await model.generateContent([
      { text: EXTRACT_PROMPT },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64,
        },
      },
    ]);

    const text = result.response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502 }
      );
    }

    const blocks = normalizeBlocks(parsed);
    const payload: ExtractResult = { blocks };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Extraction error:", err);
    return NextResponse.json(
      { error: "Text extraction failed" },
      { status: 500 }
    );
  }
}
